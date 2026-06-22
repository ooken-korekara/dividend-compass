# Dividend Compass

長期保有向けの高配当株候補を、利回りだけでなく配当持続性・増配力・財務健全性・収益安定性・割安度から確認する、日本語のフロントエンドMVPです。

<p align="center">
  <a href="https://ooken-korekara.github.io/dividend-compass/">
    <img src="https://img.shields.io/badge/%E2%96%B6_%E3%82%A2%E3%83%97%E3%83%AA%E3%82%92%E8%B5%B7%E5%8B%95-164F3D?style=for-the-badge" alt="Dividend Compassを起動する">
  </a>
</p>

## 起動方法

依存パッケージはありません。`index.html` をブラウザで開くか、ローカルサーバーを起動してください。

```bash
python3 -m http.server 8000
```

その後 `http://localhost:8000` を開きます。

## 主な機能

- 高配当株スクリーニング
- IR BANKで証券コード・社名検索
- 独自の5軸・100点評価
- 銘柄詳細とリスク表示
- ウォッチリスト（ブラウザ内に保存）
- 配当再投資シミュレーター
- ライト／ダーク表示とレスポンシブ対応

## データについて

現在の全銘柄・指標はUI検証用の架空データです。実際の投資判断には使用できません。実運用時は、財務・株価・配当履歴の正規データをバックエンドで取得し、更新日と出典を各指標に表示してください。

「実在する企業を調べる」検索は、入力した証券コードまたは社名を [IR BANK](https://irbank.net/) の検索結果へ送信します。IR BANKのデータを本リポジトリへ複製・保存する機能ではありません。

実データ化の第一候補は、JPX公式の [J-Quants API](https://www.jpx.co.jp/markets/other-data-services/j-quants-api/index.html) です。上場銘柄一覧、調整済み株価、四半期財務、配当の決定・予想をまとめて取得できます。より長期の開示書類を検証する場合は、金融庁の [EDINET API](https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WZEK0110.html) を補助データ源にします。減配・増配など最新の会社発表を追う用途では、JPXの [TDnet](https://www.jpx.co.jp/equities/listing/disclosure/tdnet/index.html) を併用します。

APIキーはブラウザへ置かず、バックエンドの環境変数で管理してください。銘柄ごとに「株価基準日」「決算期」「データ更新日時」「出典」を表示し、予想値と実績値を混在させない設計が必要です。

## スコア設計（案）

- 配当持続性 25%: 配当性向、FCF配当性向、減配履歴
- 増配力 20%: 5年DPS CAGR、EPS成長、連続増配・非減配年数
- 財務健全性 20%: 自己資本比率、Net Debt / EBITDA、流動性
- 収益安定性 20%: 営業利益と営業CFの安定度、ROIC
- 割安度 15%: 過去利回りレンジ、PER、PBR、FCF利回り

これは投資助言ではなく、調査を支援するためのデモアプリです。
