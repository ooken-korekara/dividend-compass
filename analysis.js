const analysisState = { configured: false, checked: false };

function initAnalysis() {
  document.querySelectorAll('.company-analysis-form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const query = new FormData(form).get('query')?.toString().trim();
      if (!query) return;
      document.querySelectorAll('.company-analysis-form input[name="query"]').forEach(input => { input.value = query; });
      switchView('analysis');
      runCompanyAnalysis(query);
    });
  });
  checkAnalysisConnection();
}

async function checkAnalysisConnection() {
  try {
    const response = await fetch('./api/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('backend unavailable');
    const health = await response.json();
    analysisState.configured = Boolean(health.configured);
    analysisState.checked = true;
    updateDataMode(analysisState.configured);
    if (!analysisState.configured) showAnalysisSetup('`.env` にJ-Quants APIキーを設定して、`python3 server.py` で起動してください。');
  } catch (error) {
    analysisState.checked = true;
    updateDataMode(false, true);
    showAnalysisSetup('公開版ではAPIキーを安全に保管できません。実データ分析はローカル版を `python3 server.py` で起動して利用してください。');
  }
}

function updateDataMode(connected, staticOnly = false) {
  const label = document.querySelector('#dataModeLabel');
  const detail = document.querySelector('#dataModeDetail');
  const market = document.querySelector('#marketStatusText');
  if (connected) {
    label.textContent = '実データ接続済み';
    detail.textContent = 'J-Quants API V2';
    market.textContent = 'JPX公式データ接続済み';
  } else {
    label.textContent = staticOnly ? '公開デモモード' : 'APIキー未設定';
    detail.textContent = staticOnly ? '実分析はローカル版' : 'J-Quants API V2';
    market.textContent = '日本株デモデータ';
  }
}

async function runCompanyAnalysis(query) {
  hideAnalysisMessages();
  document.querySelector('#analysisLoading').hidden = false;
  try {
    if (!/^\d{4,5}$/.test(query)) {
      const search = await analysisFetch(`./api/search?query=${encodeURIComponent(query)}`);
      if (!search.results?.length) throw new Error('該当する上場企業が見つかりませんでした。');
      if (search.results.length > 1) {
        renderSearchCandidates(search.results, query);
        return;
      }
      query = search.results[0].code;
    }
    const analysis = await analysisFetch(`./api/analyze?code=${encodeURIComponent(query)}`);
    renderCompanyAnalysis(analysis);
  } catch (error) {
    showAnalysisSetup(error.message || '企業分析データを取得できませんでした。');
  } finally {
    document.querySelector('#analysisLoading').hidden = true;
  }
}

async function analysisFetch(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new Error('分析サーバーに接続できません。`python3 server.py` で起動してください。');
  }
  let body = {};
  try { body = await response.json(); } catch (error) { /* Static hosts return HTML errors. */ }
  if (!response.ok) {
    if (response.status === 503) throw new Error('J-Quants APIキーが未設定です。`.env` を確認してください。');
    if (response.status === 401 || response.status === 403) throw new Error('J-Quants APIキーまたは契約プランを確認してください。');
    throw new Error(body.error || '分析データを取得できませんでした。');
  }
  return body;
}

function hideAnalysisMessages() {
  document.querySelector('#analysisSetup').hidden = true;
  document.querySelector('#searchCandidates').hidden = true;
  document.querySelector('#analysisEmpty').hidden = true;
  document.querySelector('#analysisDashboard').hidden = true;
}

function showAnalysisSetup(message) {
  document.querySelector('#analysisSetupMessage').textContent = message;
  document.querySelector('#analysisSetup').hidden = false;
  document.querySelector('#analysisDashboard').hidden = true;
  document.querySelector('#analysisEmpty').hidden = true;
}

function renderSearchCandidates(results, query) {
  const container = document.querySelector('#searchCandidates');
  container.innerHTML = `<div class="candidate-heading"><div><span class="section-kicker">SEARCH RESULTS</span><h2>「${escapeAnalysisHtml(query)}」の検索結果</h2></div><span>${results.length}社</span></div><div class="candidate-list">${results.map(company => `<button type="button" data-analysis-code="${company.code}"><span>${company.code}</span><strong>${escapeAnalysisHtml(company.name)}</strong><small>${escapeAnalysisHtml(company.sector || '業種未分類')} · ${escapeAnalysisHtml(company.market || '市場未分類')}</small><b>→</b></button>`).join('')}</div>`;
  container.hidden = false;
  container.querySelectorAll('[data-analysis-code]').forEach(button => button.addEventListener('click', () => runCompanyAnalysis(button.dataset.analysisCode)));
}

function renderCompanyAnalysis(data) {
  const { company, metrics, scores, history, assessment, source } = data;
  document.querySelector('#analysisCompanyMark').textContent = company.name.slice(0, 1);
  document.querySelector('#analysisCompanyName').textContent = company.name;
  document.querySelector('#analysisCompanyMeta').textContent = `${company.code} · ${company.sector || '業種未分類'} · ${company.market || '市場未分類'}`;
  document.querySelector('#analysisTotalScore').textContent = scores.total;
  document.querySelector('#analysisGrade').textContent = `${scores.grade} · ${assessment.label}`;
  document.querySelector('#analysisConfidence').textContent = `データ充足度 ${scores.confidence}%`;
  document.querySelector('#analysisJudgement').textContent = assessment.label;
  document.querySelector('#analysisSummary').textContent = assessment.summary;
  document.querySelector('#analysisCaution').textContent = assessment.caution;
  document.querySelector('#analysisUpdatedAt').textContent = `更新 ${source.priceDate || source.updatedAt} · ${source.name}`;

  const keyMetrics = [
    ['予想配当利回り', metricPercent(metrics.dividendYield), metrics.dividendPerShare != null ? `年間 ${metricNumber(metrics.dividendPerShare)}円` : '配当データなし'],
    ['配当性向', metricPercent(metrics.payoutRatio), metrics.payoutRatio != null && metrics.payoutRatio <= 65 ? '余力を確認' : '水準を要確認'],
    ['自己資本比率', metricPercent(metrics.equityRatio), '最新決算'],
    ['非減配年数', metrics.nonDecreaseYears != null ? `${metrics.nonDecreaseYears}年` : '—', `DPS CAGR ${metricPercent(metrics.dividendCagr)}`],
    ['概算PER', metrics.per != null ? `${metricNumber(metrics.per, 1)}倍` : '—', `株価 ${metrics.close != null ? metricNumber(metrics.close) + '円' : '—'}`],
    ['営業CFプラス', metrics.cfoPositiveRatio != null ? `${Math.round(metrics.cfoPositiveRatio)}%` : '—', '取得年度内']
  ];
  document.querySelector('#analysisKeyMetrics').innerHTML = keyMetrics.map(([label,value,note]) => `<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');

  const scoreItems = [scores.sustainability, scores.growth, scores.finance, scores.stability, scores.valuation];
  document.querySelector('#analysisScoreList').innerHTML = scoreItems.map(item => `<div class="analysis-score-row"><div><strong>${item.label}</strong><small>${escapeAnalysisHtml(item.note)}</small></div><span>${item.score}</span><div class="analysis-score-track"><i style="width:${item.score}%"></i></div></div>`).join('');

  document.querySelector('#analysisHistoryRows').innerHTML = history.length ? history.map(row => `<tr><td>${escapeAnalysisHtml(row.period || '—')}</td><td>${metricAmount(row.sales)}</td><td>${metricAmount(row.operatingProfit)}</td><td>${metricAmount(row.netProfit)}</td><td>${metricYen(row.eps)}</td><td>${metricYen(row.dividend)}</td><td>${metricPercent(row.payoutRatio)}</td><td>${metricPercent(row.equityRatio)}</td></tr>`).join('') : '<tr><td colspan="8">比較可能な通期データがありません</td></tr>';

  document.querySelector('#analysisDashboard').hidden = false;
}

function metricNumber(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
function metricPercent(value) { return value == null ? '—' : `${metricNumber(value, 1)}%`; }
function metricYen(value) { return value == null ? '—' : `${metricNumber(value, 1)}円`; }
function metricAmount(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1e12) return `${metricNumber(n / 1e12, 2)}兆円`;
  if (Math.abs(n) >= 1e8) return `${metricNumber(n / 1e8, 1)}億円`;
  if (Math.abs(n) >= 1e4) return `${metricNumber(n / 1e4, 1)}万円`;
  return `${metricNumber(n)}円`;
}
function escapeAnalysisHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

window.initAnalysis = initAnalysis;
window.runCompanyAnalysis = runCompanyAnalysis;
