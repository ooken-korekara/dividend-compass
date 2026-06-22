#!/usr/bin/env python3
"""Dividend Compass local server with a J-Quants API V2 gateway."""

from __future__ import annotations

import json
import math
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
JQUANTS_BASE = "https://api.jquants.com/v2"
USER_AGENT = "DividendCompass/1.0 (personal investment research)"


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_dotenv()
API_KEY = os.environ.get("JQUANTS_API_KEY", "").strip()


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class JQuants:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._cache: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        query = urllib.parse.urlencode(params or {})
        url = f"{JQUANTS_BASE}{path}" + (f"?{query}" if query else "")
        request = urllib.request.Request(
            url,
            headers={"x-api-key": self.api_key, "User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
                detail = payload.get("message") or payload.get("error") or str(error)
            except Exception:
                detail = str(error)
            if error.code in (401, 403):
                detail = "J-Quants APIキーまたは契約プランを確認してください。"
            elif error.code == 429:
                detail = "J-Quants APIの呼び出し上限に達しました。1分ほど待って再試行してください。"
            raise ApiError(error.code, detail) from error
        except urllib.error.URLError as error:
            raise ApiError(502, "J-Quants APIへ接続できませんでした。") from error

    def paginated(self, path: str, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        query = dict(params or {})
        for _ in range(20):
            payload = self.get(path, query)
            batch = payload.get("data", [])
            if isinstance(batch, list):
                rows.extend(item for item in batch if isinstance(item, dict))
            pagination_key = payload.get("pagination_key")
            if not pagination_key:
                break
            query["pagination_key"] = str(pagination_key)
        return rows

    def cached(self, key: str, ttl: int, loader):
        with self._lock:
            cached = self._cache.get(key)
            if cached and time.time() - cached[0] < ttl:
                return cached[1]
        value = loader()
        with self._lock:
            self._cache[key] = (time.time(), value)
        return value

    def master(self) -> list[dict[str, Any]]:
        return self.cached("master", 24 * 3600, lambda: self.paginated("/equities/master"))

    def search(self, query: str) -> list[dict[str, str]]:
        normalized = normalize_text(query)
        if re.fullmatch(r"\d{4,5}", query):
            rows = self.paginated("/equities/master", {"code": query})
        else:
            rows = self.master()
        results = []
        for row in rows:
            code = display_code(row.get("Code"))
            name = str(row.get("CoName") or "")
            english = str(row.get("CoNameEn") or "")
            if normalized not in normalize_text(f"{code} {name} {english}"):
                continue
            results.append({
                "code": code,
                "name": name,
                "sector": str(row.get("S33Nm") or ""),
                "market": str(row.get("MktNm") or ""),
            })
        return results[:20]

    def company(self, code: str) -> dict[str, Any]:
        rows = self.paginated("/equities/master", {"code": code})
        if not rows:
            raise ApiError(404, "該当する上場企業が見つかりませんでした。")
        exact = [row for row in rows if display_code(row.get("Code")) == code[:4]]
        return exact[0] if exact else rows[0]

    def analyze(self, code: str) -> dict[str, Any]:
        code = re.sub(r"\D", "", code)[:5]
        if len(code) not in (4, 5):
            raise ApiError(400, "4桁または5桁の証券コードを入力してください。")
        cache_key = f"analysis:{code}"
        return self.cached(cache_key, 15 * 60, lambda: self._analyze_uncached(code))

    def _analyze_uncached(self, code: str) -> dict[str, Any]:
        company = self.company(code)
        summaries = self.paginated("/fins/summary", {"code": code})
        start = (date.today() - timedelta(days=550)).strftime("%Y%m%d")
        prices = self.paginated("/equities/bars/daily", {"code": code, "from": start})
        if not summaries:
            raise ApiError(422, "分析可能な決算サマリーがありません。")
        return build_analysis(company, summaries, prices)


def normalize_text(value: Any) -> str:
    return re.sub(r"[\s　・･（）()\-]", "", str(value or "")).lower()


def display_code(value: Any) -> str:
    code = re.sub(r"\D", "", str(value or ""))
    return code[:4] if len(code) >= 5 and code.endswith("0") else code


def number(value: Any) -> float | None:
    if value is None or value == "" or value == "-":
        return None
    try:
        result = float(str(value).replace(",", ""))
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def latest_value(rows: list[dict[str, Any]], *keys: str) -> float | None:
    for row in sorted(rows, key=lambda item: (str(item.get("DiscDate") or ""), str(item.get("DiscTime") or "")), reverse=True):
        for key in keys:
            value = number(row.get(key))
            if value is not None:
                return value
    return None


def annual_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    ordered = sorted(rows, key=lambda item: (str(item.get("DiscDate") or ""), str(item.get("DiscTime") or "")))
    for row in ordered:
        if str(row.get("CurPerType") or "").upper() != "FY":
            continue
        period = str(row.get("CurPerEn") or "")
        if not period:
            continue
        if any(number(row.get(key)) is not None for key in ("Sales", "OP", "NP", "EPS", "DivAnn", "EqAR")):
            selected[period] = row
    return [selected[key] for key in sorted(selected)]


def ratio_positive(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    return (sum(value > 0 for value in present) / len(present) * 100) if present else None


def cagr(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None and value > 0]
    if len(present) < 2:
        return None
    years = len(present) - 1
    return ((present[-1] / present[0]) ** (1 / years) - 1) * 100


def non_decrease_years(values: list[float | None]) -> int | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    years = 1
    for index in range(len(present) - 1, 0, -1):
        if present[index] + 0.001 >= present[index - 1]:
            years += 1
        else:
            break
    return min(years, len(present))


def payout_score(value: float | None) -> float:
    if value is None:
        return 45
    if 25 <= value <= 55:
        return 95
    if 0 <= value < 25:
        return 78
    if value <= 70:
        return 82
    if value <= 85:
        return 62
    if value <= 100:
        return 40
    return 20


def equity_score(value: float | None) -> float:
    if value is None:
        return 45
    if value >= 70:
        return 100
    if value >= 55:
        return 90
    if value >= 40:
        return 75
    if value >= 25:
        return 55
    return 30


def growth_score(value: float | None) -> float:
    if value is None:
        return 45
    if value >= 10:
        return 100
    if value >= 6:
        return 90
    if value >= 3:
        return 78
    if value >= 0:
        return 62
    return 30


def yield_score(value: float | None) -> float:
    if value is None:
        return 40
    if 3 <= value <= 5:
        return 92
    if 2 <= value < 3:
        return 72
    if 5 < value <= 7:
        return 70
    if value > 7:
        return 45
    return 45


def per_score(value: float | None) -> float:
    if value is None or value <= 0:
        return 45
    if 8 <= value <= 16:
        return 90
    if 5 <= value < 8 or 16 < value <= 22:
        return 72
    if value <= 30:
        return 55
    return 35


def build_analysis(company: dict[str, Any], summaries: list[dict[str, Any]], prices: list[dict[str, Any]]) -> dict[str, Any]:
    annual = annual_rows(summaries)
    basis = annual if annual else sorted(summaries, key=lambda row: str(row.get("DiscDate") or ""))[-1:]
    latest = basis[-1]

    prices = sorted(prices, key=lambda row: str(row.get("Date") or ""))
    latest_price = prices[-1] if prices else {}
    close = number(latest_price.get("AdjC")) or number(latest_price.get("C"))
    actual_dividends = [number(row.get("DivAnn")) for row in annual]
    forecast_dividend = latest_value(summaries, "FDivAnn", "NxFDivAnn", "DivAnn")
    dividend = forecast_dividend if forecast_dividend is not None else (actual_dividends[-1] if actual_dividends else None)
    eps = latest_value(summaries, "FEPS", "NxFEPS", "EPS")
    payout = latest_value(summaries, "FPayoutRatioAnn", "NxFPayoutRatioAnn", "PayoutRatioAnn")
    if payout is None and dividend is not None and eps not in (None, 0):
        payout = dividend / eps * 100
    equity_ratio = latest_value(summaries, "EqAR")
    cfo_ratio = ratio_positive([number(row.get("CFO")) for row in annual])
    np_ratio = ratio_positive([number(row.get("NP")) for row in annual])
    dps_cagr = cagr(actual_dividends)
    non_decrease = non_decrease_years(actual_dividends)
    dividend_yield = dividend / close * 100 if dividend is not None and close else None
    per = close / eps if close and eps and eps > 0 else None

    sustainability = round(clamp(payout_score(payout) * 0.65 + (cfo_ratio if cfo_ratio is not None else 45) * 0.35))
    growth = round(clamp(growth_score(dps_cagr) * 0.7 + min((non_decrease or 0) * 8, 100) * 0.3))
    finance = round(clamp(equity_score(equity_ratio) * 0.7 + (cfo_ratio if cfo_ratio is not None else 45) * 0.3))
    stability = round(clamp((np_ratio if np_ratio is not None else 45) * 0.65 + (cfo_ratio if cfo_ratio is not None else 45) * 0.35))
    valuation = round(clamp(yield_score(dividend_yield) * 0.6 + per_score(per) * 0.4))
    total = round(sustainability * 0.25 + growth * 0.20 + finance * 0.20 + stability * 0.20 + valuation * 0.15)

    score_rows = [
        {"label": "配当の持続性", "score": sustainability, "note": f"配当性向 {fmt(payout, '%')}・営業CFプラス {fmt(cfo_ratio, '%')}"},
        {"label": "増配力", "score": growth, "note": f"DPS CAGR {fmt(dps_cagr, '%')}・非減配 {non_decrease if non_decrease is not None else '—'}年"},
        {"label": "財務健全性", "score": finance, "note": f"自己資本比率 {fmt(equity_ratio, '%')}・営業CFの継続性"},
        {"label": "収益安定性", "score": stability, "note": f"純利益黒字率 {fmt(np_ratio, '%')}・CF黒字率 {fmt(cfo_ratio, '%')}"},
        {"label": "割安度", "score": valuation, "note": f"予想利回り {fmt(dividend_yield, '%')}・概算PER {fmt(per, '倍')}"},
    ]

    available = [payout, equity_ratio, cfo_ratio, np_ratio, dps_cagr, non_decrease, dividend_yield, per]
    confidence = round(sum(value is not None for value in available) / len(available) * 100)
    grade = "S" if total >= 90 else "A" if total >= 80 else "B" if total >= 70 else "C" if total >= 60 else "D"
    label = "長期保有候補として有力" if total >= 80 else "候補として継続確認" if total >= 70 else "慎重に確認" if total >= 60 else "現時点では注意"
    best = max(score_rows, key=lambda item: item["score"])["label"]
    weakest = min(score_rows, key=lambda item: item["score"])["label"]
    summary = f"{best}が相対的な強みです。一方、{weakest}は追加確認が必要です。利回りだけでなく、配当余力と利益・キャッシュフローの継続性を合わせて評価しています。"

    cautions = []
    if len(annual) < 3:
        cautions.append("取得できる通期データが3期未満のため、長期傾向の確度は限定的です")
    if payout is not None and payout > 80:
        cautions.append("配当性向が80%を超えています")
    if equity_ratio is not None and equity_ratio < 40:
        cautions.append("自己資本比率が40%未満です")
    if dps_cagr is not None and dps_cagr < 0:
        cautions.append("取得期間内の年間配当が減少傾向です")
    if dividend_yield is not None and dividend_yield > 7:
        cautions.append("高利回りの背景に株価下落や減配懸念がないか確認してください")
    caution = "。".join(cautions) + ("。" if cautions else "") if cautions else "決算短信、配当方針、事業リスクを企業IRで確認してください。"

    history = []
    for row in annual[-7:]:
        row_dividend = number(row.get("DivAnn"))
        row_eps = number(row.get("EPS"))
        row_payout = number(row.get("PayoutRatioAnn"))
        if row_payout is None and row_dividend is not None and row_eps not in (None, 0):
            row_payout = row_dividend / row_eps * 100
        history.append({
            "period": row.get("CurPerEn"),
            "sales": number(row.get("Sales")),
            "operatingProfit": number(row.get("OP")),
            "netProfit": number(row.get("NP")),
            "eps": row_eps,
            "dividend": row_dividend,
            "payoutRatio": row_payout,
            "equityRatio": number(row.get("EqAR")),
        })

    return {
        "company": {
            "code": display_code(company.get("Code")),
            "name": str(company.get("CoName") or "名称不明"),
            "sector": str(company.get("S33Nm") or ""),
            "market": str(company.get("MktNm") or ""),
        },
        "metrics": {
            "close": close,
            "dividendPerShare": dividend,
            "dividendYield": dividend_yield,
            "payoutRatio": payout,
            "equityRatio": equity_ratio,
            "nonDecreaseYears": non_decrease,
            "dividendCagr": dps_cagr,
            "per": per,
            "cfoPositiveRatio": cfo_ratio,
        },
        "scores": {
            "total": total,
            "grade": grade,
            "confidence": confidence,
            "sustainability": score_rows[0],
            "growth": score_rows[1],
            "finance": score_rows[2],
            "stability": score_rows[3],
            "valuation": score_rows[4],
        },
        "assessment": {"label": label, "summary": summary, "caution": caution},
        "history": history,
        "source": {
            "name": "J-Quants API V2",
            "priceDate": latest_price.get("Date"),
            "updatedAt": date.today().isoformat(),
            "disclosureDate": latest.get("DiscDate"),
        },
    }


def fmt(value: float | None, suffix: str) -> str:
    return "—" if value is None else f"{value:.1f}{suffix}"


CLIENT = JQuants(API_KEY) if API_KEY else None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()
        try:
            if parsed.path == "/api/health":
                return self.send_json(200, {"ok": True, "configured": CLIENT is not None, "provider": "J-Quants API V2"})
            if CLIENT is None:
                raise ApiError(503, "J-Quants APIキーが未設定です。")
            params = urllib.parse.parse_qs(parsed.query)
            if parsed.path == "/api/search":
                query = params.get("query", [""])[0].strip()
                if len(query) < 2:
                    raise ApiError(400, "証券コードまたは2文字以上の社名を入力してください。")
                return self.send_json(200, {"results": CLIENT.search(query)})
            if parsed.path == "/api/analyze":
                code = params.get("code", [""])[0].strip()
                return self.send_json(200, CLIENT.analyze(code))
            raise ApiError(404, "APIが見つかりません。")
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception:
            self.send_json(500, {"error": "分析処理中に予期しないエラーが発生しました。"})

    def send_json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    status = "J-Quants接続済み" if CLIENT else "APIキー未設定（デモ表示のみ）"
    print(f"Dividend Compass: http://{host}:{port} — {status}")
    server = ThreadingHTTPServer((host, port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDividend Compassを終了しました。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
