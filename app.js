const stocks = [
  { code:'4072', name:'東海通信', sector:'情報・通信', logo:'TK', color:'#285b4a', score:92, yield:3.8, payout:43, years:18, equity:67, cashflow:true, dividend:124, growth:7.2, debt:0.18, stability:95, dividendScore:94, growthScore:91, financeScore:96, profitScore:89, valueScore:82, note:'利益と配当が緩やかに伸び、配当性向にも余裕があります。財務の安全性が高い長期保有候補です。', risk:'海外売上比率が高く、為替変動が業績に影響する可能性があります。' },
  { code:'6158', name:'みらい精工', sector:'機械', logo:'MS', color:'#596c51', score:88, yield:4.2, payout:51, years:14, equity:58, cashflow:true, dividend:168, growth:5.8, debt:0.31, stability:86, dividendScore:90, growthScore:84, financeScore:88, profitScore:85, valueScore:91, note:'景気敏感株ながら、安定したキャッシュ創出力と無理のない配当性向が魅力です。', risk:'設備投資サイクルの悪化時には、利益が大きく変動する場合があります。' },
  { code:'2817', name:'北都フーズ', sector:'食料品', logo:'HF', color:'#9a7444', score:86, yield:3.4, payout:57, years:21, equity:52, cashflow:true, dividend:92, growth:3.9, debt:0.26, stability:94, dividendScore:93, growthScore:76, financeScore:84, profitScore:92, valueScore:78, note:'生活必需品の安定需要を背景に、長い非減配実績を持つ守備的な候補です。', risk:'原材料価格の上昇を販売価格へ転嫁できない場合、利益率が低下します。' },
  { code:'8364', name:'あおば銀行', sector:'銀行業', logo:'AB', color:'#345f72', score:84, yield:4.6, payout:39, years:11, equity:46, cashflow:true, dividend:76, growth:6.1, debt:0.42, stability:79, dividendScore:87, growthScore:88, financeScore:74, profitScore:79, valueScore:93, note:'低い配当性向と割安感が特徴。金利環境の正常化が収益の追い風となる可能性があります。', risk:'信用コストの増加や金利の急変が収益を押し下げる可能性があります。' },
  { code:'9426', name:'日本ライフネット', sector:'サービス業', logo:'LN', color:'#6f5a7c', score:81, yield:3.2, payout:62, years:12, equity:71, cashflow:true, dividend:108, growth:4.6, debt:0.12, stability:88, dividendScore:84, growthScore:79, financeScore:94, profitScore:81, valueScore:70, note:'ストック型収益と厚い自己資本が強み。配当成長は穏やかですが継続性に期待できます。', risk:'人件費上昇や新規参入により、採算性が悪化する可能性があります。' },
  { code:'5103', name:'中央化成', sector:'化学', logo:'CK', color:'#547a6b', score:78, yield:5.1, payout:68, years:9, equity:44, cashflow:true, dividend:142, growth:2.8, debt:0.38, stability:72, dividendScore:75, growthScore:68, financeScore:76, profitScore:71, valueScore:95, note:'高い利回りと割安感が魅力ですが、配当余力は上位銘柄より限られます。', risk:'現在の高利回りは業績の不透明感を反映している可能性があります。' },
  { code:'7319', name:'桜モビリティ', sector:'輸送用機器', logo:'SM', color:'#855d55', score:75, yield:4.4, payout:72, years:13, equity:39, cashflow:false, dividend:116, growth:3.1, debt:0.55, stability:64, dividendScore:73, growthScore:71, financeScore:59, profitScore:70, valueScore:86, note:'利回りは魅力的ですが、財務とキャッシュフローの確認を続けたい銘柄です。', risk:'自己資本比率が基準を下回り、足元では営業CFにも変動があります。' },
  { code:'1985', name:'共栄インフラ', sector:'建設業', logo:'KI', color:'#667050', score:73, yield:3.7, payout:48, years:7, equity:61, cashflow:true, dividend:88, growth:5.2, debt:0.22, stability:69, dividendScore:72, growthScore:81, financeScore:89, profitScore:65, valueScore:67, note:'財務余力は十分。非減配実績と利益の安定性が積み上がるか観察したい候補です。', risk:'大型案件の採算悪化により、年度ごとの利益が振れる可能性があります。' },
  { code:'4521', name:'青葉メディカル', sector:'医薬品', logo:'AM', color:'#47767b', score:71, yield:2.6, payout:64, years:16, equity:74, cashflow:true, dividend:102, growth:2.1, debt:0.09, stability:82, dividendScore:78, growthScore:58, financeScore:97, profitScore:83, valueScore:52, note:'強固な財務と安定した収益が魅力ですが、現在の利回りはやや低めです。', risk:'主力製品の特許切れや研究開発の遅延が収益へ影響する可能性があります。' }
];

const metrics = [
  ['01','♢','配当の持続性','配当性向・フリーCFから減配リスクを確認'],
  ['02','↗','増配力','増配実績と利益成長の両方を評価'],
  ['03','▥','財務健全性','自己資本と有利子負債のバランス'],
  ['04','≋','収益安定性','景気をまたいだ利益・CFのブレを確認'],
  ['05','◎','割安度','利回りだけでなく企業価値と比較']
];

const state = { minYield:3, maxPayout:70, minYears:10, equity:true, cashflow:false, search:'', sort:'score', watched:JSON.parse(localStorage.getItem('dc-watchlist') || '[]') };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const yen = new Intl.NumberFormat('ja-JP', { style:'currency', currency:'JPY', maximumFractionDigits:0 });

function init() {
  $('#metricGrid').innerHTML = metrics.map(m => `<article class="metric"><div class="metric-top"><span class="metric-index">${m[0]}</span><span class="metric-icon">${m[1]}</span></div><strong>${m[2]}</strong><p>${m[3]}</p></article>`).join('');
  bindEvents();
  updateRange($('#yieldRange'));
  updateRange($('#payoutRange'));
  renderStocks();
  renderWatchlist();
  calculateSimulation();
  if (window.initAnalysis) window.initAnalysis();
}

function bindEvents() {
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.go)));
  $('#menuButton').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  $('#themeButton').addEventListener('click', () => document.body.classList.toggle('dark'));
  $('#yieldRange').addEventListener('input', e => { $('#yieldOutput').value = `${Number(e.target.value).toFixed(1)}%以上`; updateRange(e.target); });
  $('#payoutRange').addEventListener('input', e => { $('#payoutOutput').value = `${e.target.value}%以下`; updateRange(e.target); });
  $$('#yearsFilter button').forEach(btn => btn.addEventListener('click', () => { $$('#yearsFilter button').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); }));
  $('#applyFilters').addEventListener('click', applyFilters);
  $('#searchInput').addEventListener('input', e => { state.search=e.target.value.trim().toLowerCase(); renderStocks(); });
  $('#searchInput').addEventListener('keydown', e => { if(e.key==='Enter') applyFilters(); });
  $('#sortSelect').addEventListener('change', e => { state.sort=e.target.value; renderStocks(); });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#modalClose').addEventListener('click', closeModal);
  $('#stockModal').addEventListener('click', e => { if(e.target.id==='stockModal') closeModal(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
  $('#calculateButton').addEventListener('click', calculateSimulation);
}

function switchView(name) {
  $$('.view').forEach(v=>v.classList.remove('active'));
  $$('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.view===name));
  $(`#${name}View`).classList.add('active');
  $('.sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='watchlist') renderWatchlist();
}

function updateRange(input) {
  const pct=((input.value-input.min)/(input.max-input.min))*100;
  input.style.background=`linear-gradient(to right, var(--green-2) ${pct}%, #dce0da ${pct}%)`;
}

function applyFilters() {
  state.minYield=Number($('#yieldRange').value);
  state.maxPayout=Number($('#payoutRange').value);
  state.minYears=Number($('#yearsFilter .selected').dataset.value);
  state.equity=$('#equityCheck').checked;
  state.cashflow=$('#cashflowCheck').checked;
  state.search=$('#searchInput').value.trim().toLowerCase();
  renderStocks();
  showToast('スクリーニング条件を適用しました');
}

function resetFilters() {
  $('#yieldRange').value=0; $('#yieldOutput').value='0.0%以上';
  $('#payoutRange').value=100; $('#payoutOutput').value='100%以下';
  $$('#yearsFilter button').forEach(b=>b.classList.toggle('selected',b.dataset.value==='0'));
  $('#equityCheck').checked=false; $('#cashflowCheck').checked=false; $('#searchInput').value='';
  state.minYield=0; state.maxPayout=100; state.minYears=0; state.equity=false; state.cashflow=false; state.search='';
  updateRange($('#yieldRange')); updateRange($('#payoutRange')); renderStocks();
}

function getFiltered() {
  const list=stocks.filter(s => s.yield>=state.minYield && s.payout<=state.maxPayout && s.years>=state.minYears && (!state.equity || s.equity>=40) && (!state.cashflow || s.cashflow) && (!state.search || `${s.name}${s.code}${s.sector}`.toLowerCase().includes(state.search)));
  return list.sort((a,b) => state.sort==='yield'?b.yield-a.yield:state.sort==='years'?b.years-a.years:state.sort==='payout'?a.payout-b.payout:b.score-a.score);
}

function grade(score) { return score>=90?['S','最優先候補']:score>=85?['A+','有力候補']:score>=80?['A','候補']:score>=75?['B+','要確認']:['B','観察']; }

function renderStocks() {
  const filtered=getFiltered();
  $('#resultCount').textContent=`${filtered.length}銘柄`;
  $('#stockRows').innerHTML=filtered.map(s => {
    const g=grade(s.score); const watched=state.watched.includes(s.code);
    return `<tr data-code="${s.code}" tabindex="0"><td><div class="stock-name"><span class="stock-logo" style="background:${s.color}">${s.logo}</span><div><strong>${s.name}</strong><small>${s.code} · ${s.sector}</small></div></div></td><td><div class="score-cell"><span class="score-ring" style="--score:${s.score}"><b>${s.score}</b></span><span class="grade">${g[0]}<small>${g[1]}</small></span></div></td><td><span class="yield-value">${s.yield.toFixed(1)}%</span><span class="sub-value">年間 ${s.dividend}円</span></td><td><b>${s.payout}%</b><span class="sub-value">${s.payout<=50?'余力あり':s.payout<=70?'適正水準':'要確認'}</span></td><td><b>${s.years}年</b><span class="sub-value">増配率 ${s.growth}%</span></td><td><span class="safety ${s.equity<40?'warn':''}">${s.equity>=55?'堅固':s.equity>=40?'安定':'注意'}</span><span class="sub-value">自己資本 ${s.equity}%</span></td><td><button class="watch-button ${watched?'saved':''}" data-watch="${s.code}" aria-label="${watched?'ウォッチリストから削除':'ウォッチリストに追加'}">${watched?'♥':'♡'}</button></td></tr>`;
  }).join('');
  $('#emptyState').hidden=filtered.length>0;
  $('#activeFilters').innerHTML=[state.minYield?`利回り ${state.minYield.toFixed(1)}%〜`:'',state.maxPayout<100?`配当性向 〜${state.maxPayout}%`:'',state.minYears?`非減配 ${state.minYears}年〜`:'',state.equity?'自己資本 40%〜':'',state.cashflow?'営業CF 5年プラス':''].filter(Boolean).map(v=>`<span class="filter-chip">${v}</span>`).join('');
  $$('#stockRows tr').forEach(row=>{ row.addEventListener('click',e=>{if(!e.target.closest('[data-watch]')) openModal(row.dataset.code)}); row.addEventListener('keydown',e=>{if(e.key==='Enter')openModal(row.dataset.code)}); });
  $$('[data-watch]').forEach(btn=>btn.addEventListener('click',()=>toggleWatch(btn.dataset.watch)));
}

function toggleWatch(code) {
  const i=state.watched.indexOf(code);
  if(i>=0) { state.watched.splice(i,1); showToast('ウォッチリストから削除しました'); }
  else { state.watched.push(code); showToast('ウォッチリストに追加しました'); }
  localStorage.setItem('dc-watchlist',JSON.stringify(state.watched));
  renderStocks(); renderWatchlist();
}

function renderWatchlist() {
  const list=stocks.filter(s=>state.watched.includes(s.code));
  $('#watchCount').textContent=list.length;
  $('#emptyWatch').hidden=list.length>0; $('#watchGrid').hidden=list.length===0;
  $('#watchGrid').innerHTML=list.map(s=>`<article class="watch-card"><div class="watch-card-top"><div class="stock-name"><span class="stock-logo" style="background:${s.color}">${s.logo}</span><div><strong>${s.name}</strong><small>${s.code} · ${s.sector}</small></div></div><button class="watch-button saved" data-remove="${s.code}">♥</button></div><div class="watch-score"><strong>${s.score}</strong><span>/ 100 · ${grade(s.score)[1]}</span></div><div class="watch-metrics"><div><span>配当利回り</span><strong>${s.yield}%</strong></div><div><span>配当性向</span><strong>${s.payout}%</strong></div><div><span>非減配</span><strong>${s.years}年</strong></div></div></article>`).join('');
  $$('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>toggleWatch(btn.dataset.remove)));
}

function openModal(code) {
  const s=stocks.find(x=>x.code===code); if(!s)return;
  const items=[['配当持続性',s.dividendScore],['増配力',s.growthScore],['財務健全性',s.financeScore],['収益安定性',s.profitScore],['割安度',s.valueScore]];
  $('#modalContent').innerHTML=`<div class="modal-identity"><span class="stock-logo" style="background:${s.color}">${s.logo}</span><div><h2 id="modalTitle">${s.name}</h2><p>${s.code} · ${s.sector}　※架空のデモ銘柄</p></div></div><div class="modal-summary"><div><span class="section-kicker">TOTAL SCORE</span><div class="big-score"><strong>${s.score}</strong><span>/ 100</span></div></div><div class="modal-comment"><b>${grade(s.score)[1]}</b><p>${s.note}</p></div></div><div class="score-breakdown">${items.map(i=>`<div class="score-item"><span>${i[0]}</span><strong>${i[1]}</strong><div class="bar"><i style="width:${i[1]}%"></i></div></div>`).join('')}</div><div class="attention-box"><strong>確認しておきたいリスク</strong><p>${s.risk}</p></div>`;
  $('#stockModal').hidden=false; document.body.style.overflow='hidden';
}
function closeModal(){ $('#stockModal').hidden=true; document.body.style.overflow=''; }

function calculateSimulation() {
  const initial=Math.max(0,Number($('#initialAmount').value)||0), monthly=Math.max(0,Number($('#monthlyAmount').value)||0), startYield=Math.max(0,Number($('#simYield').value)||0)/100, growth=Number($('#growthRate').value||0)/100, years=Math.min(50,Math.max(1,Number($('#investYears').value)||1)), reinvest=$('#reinvestToggle').checked;
  let capital=initial, totalDiv=0, currentYield=startYield; const points=[];
  for(let y=0;y<=years;y++) { const annual=capital*currentYield; points.push(annual); if(y<years){ totalDiv+=annual; capital+=monthly*12+(reinvest?annual:0); currentYield*=1+growth; } }
  const finalAnnual=points.at(-1), totalInvested=initial+monthly*12*years;
  $('#futureYearLabel').textContent=`${years}年後の年間配当`; $('#futureDividend').textContent=yen.format(finalAnnual); $('#multipleBadge').textContent=`現在の ${(finalAnnual/(points[0]||1)).toFixed(1)}倍`; $('#totalInvested').textContent=yen.format(totalInvested); $('#totalDividend').textContent=yen.format(totalDiv); $('#finalValue').textContent=yen.format(capital); $('#axisMid').textContent=`${Math.round(years/2)}年後`; $('#axisEnd').textContent=`${years}年後`;
  drawChart(points);
}

function drawChart(points) {
  const w=700,h=260,pad=8,max=Math.max(...points,1); const coords=points.map((v,i)=>[pad+(i/(points.length-1||1))*(w-pad*2),h-pad-(v/max)*(h-pad*2)]); const line=coords.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '); $('#linePath').setAttribute('d',line); $('#areaPath').setAttribute('d',`${line} L ${coords.at(-1)[0]} ${h} L ${coords[0][0]} ${h} Z`);
}

let toastTimer;
function showToast(message){ const t=$('#toast'); t.textContent=message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1800); }

init();
