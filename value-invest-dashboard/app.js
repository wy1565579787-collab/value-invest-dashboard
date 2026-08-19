/* =========================================================================
 * 价值投资前端 · 交互逻辑 (app.js)
 * 纯前端原型：客户端路由 + 内联 SVG 图表，无第三方依赖。
 * ========================================================================= */
(function () {
  'use strict';
  const { ASSETS, DIVIDEND_STOCKS, THERMO, DEPOSIT_RATE, FUNDS, RISK_FREE, ERP } = window.VIData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const cls = (n) => n >= 0 ? 'up' : 'down';

  /* ---------------------------- 图表函数 ---------------------------- */
  function sparkline(vals, color) {
    const w = 200, h = 40, pad = 3;
    const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
    const pts = vals.map((v, i) => {
      const x = pad + i / (vals.length - 1) * (w - 2 * pad);
      const y = h - pad - (v - min) / span * (h - 2 * pad);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    const area = `M${pad},${h - pad} L` + pts.join(' L') + ` L${w - pad},${h - pad} Z`;
    const up = vals[vals.length - 1] >= vals[0];
    const c = color || (up ? 'var(--up)' : 'var(--down)');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${area}" fill="${c}" opacity="0.10"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="1.6"/></svg>`;
  }

  function lineChart(series, labels, opts = {}) {
    const W = 820, H = opts.height || 300, padL = 52, padR = 14, padT = 14, padB = 26;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    let min = Infinity, max = -Infinity;
    series.forEach(s => s.values.forEach(v => { if (v < min) min = v; if (v > max) max = v; }));
    const padv = (max - min) * 0.08 || 1; min -= padv; max += padv;
    const X = i => padL + i / (labels.length - 1) * innerW;
    const Y = v => padT + (1 - (v - min) / (max - min)) * innerH;
    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const yy = padT + g / 4 * innerH, val = max - g / 4 * (max - min);
      grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#eef0f2"/>
        <text x="${padL - 6}" y="${yy + 3}" text-anchor="end" font-size="10" fill="#9aa1ac">${fmt(val, 0)}</text>`;
    }
    let xlab = '';
    [0, Math.floor(labels.length / 2), labels.length - 1].forEach(i => {
      xlab += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#9aa1ac">${labels[i]}</text>`;
    });
    let paths = '';
    series.forEach(s => {
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      if (s.area) {
        const a = `M${padL},${Y(s.values[0])} ` + s.values.map((v, i) => `L${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ') + ` L${X(s.values.length - 1)},${padT + innerH} L${padL},${padT + innerH} Z`;
        paths += `<path d="${a}" fill="${s.color}" opacity="0.08"/>`;
      }
      paths += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="1.8"/>`;
    });
    return `<svg class="line" viewBox="0 0 ${W} ${H}">${grid}${paths}${xlab}</svg>`;
  }

  function gauge(p) {
    const cx = 110, cy = 112, R = 88;
    const pt = ang => { const a = (180 - ang * 1.8) * Math.PI / 180; return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
    let bg = '';
    for (let i = 0; i < 40; i++) { const [x, y] = pt(i / 40 * 100), [x2, y2] = pt((i + 1) / 40 * 100); bg += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#eef0f2" stroke-width="10" stroke-linecap="round"/>`; }
    let col = '#1aa053'; if (p > 66) col = '#d8392b'; else if (p > 33) col = '#b7791f';
    let fg = '';
    for (let i = 0; i < Math.max(1, Math.round(p / 100 * 40)); i++) { const [x, y] = pt(i / 40 * 100), [x2, y2] = pt((i + 1) / 40 * 100); fg += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="10" stroke-linecap="round"/>`; }
    const [nx, ny] = pt(p);
    return `<svg viewBox="0 0 220 132">${bg}${fg}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#1f2329" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#1f2329"/></svg>`;
  }

  /* ---------------------------- 计算辅助 ---------------------------- */
  function assetPct(a) {
    const vals = a.series.map(s => s.close);
    const min = Math.min(...vals), max = Math.max(...vals);
    return (a.current - min) / (max - min) * 100;
  }
  function pctBand(p) { return p > 66 ? { c: 'exp', t: '偏贵' } : p > 33 ? { c: 'mid', t: '中性' } : { c: 'cheap', t: '便宜' }; }
  function annualized(vals) { return (Math.pow(vals[vals.length - 1] / vals[0], 12 / (vals.length - 1)) - 1) * 100; }

  /* ---------------------------- 家庭资产温度计 / 懒人跟投 ---------------------------- */
  // 综合温度 = Σ(权重 × 估值分位)。低=冷=便宜=适合加仓；高=热=贵=谨慎。
  function familyTemp() {
    const w = THERMO.weights; let s = 0, ws = 0;
    ASSETS.forEach(a => { const ww = w[a.key] || 0; s += ww * (a.valuationPct == null ? 50 : a.valuationPct); ws += ww; });
    return Math.round(s / (ws || 1));
  }
  function tempBand(t) {
    if (t < 30) return { label: '历史极冷', advice: '可积极增加股票类资产仓位', cls: 'cold' };
    if (t < 50) return { label: '偏冷', advice: '适合逐步增加股票类资产仓位', cls: 'cold' };
    if (t < 70) return { label: '中性', advice: '保持现有仓位、观望为主', cls: 'mid' };
    if (t < 85) return { label: '偏热', advice: '谨慎对待新增投入', cls: 'hot' };
    return { label: '历史极热', advice: '注意风险、考虑逐步减仓', cls: 'hot' };
  }
  function tempColor(t) { return t < 50 ? 'var(--down)' : t < 70 ? 'var(--warn)' : 'var(--up)'; }

  // 取温度最低的 3 类资产 → 映射为场外基金，仓位按冷热递减
  function recommendations() {
    const sorted = ASSETS.slice().sort((a, b) => (a.valuationPct == null ? 50 : a.valuationPct) - (b.valuationPct == null ? 50 : b.valuationPct));
    const weights = [50, 30, 20];
    return sorted.slice(0, 3).map((a, i) => ({ asset: a, fund: FUNDS[a.key], weight: weights[i], rank: i + 1 }));
  }
  // 安全边际/8折模型：基于股债比价推算合理PE，看当前PE打几折
  function marginModel(a) {
    if (a.pe == null) return null;
    const eqYield = 1 / a.pe * 100;                  // 盈利收益率 %
    const fairPE = 1 / ((RISK_FREE + ERP) / 100);    // 合理 PE（盈利收益率 = 无风险+ERP 时）
    const discount = a.pe / fairPE;                  // <1=打折, >1=溢价
    return { eqYield, fairPE, discount };
  }
  // 买入逻辑说明书：大白话，不写术语
  function buyReasons(a, isPrimary) {
    const r = [], f = FUNDS[a.key];
    if (isPrimary) r.push(`这是当前全市场温度最低的一类资产，最值得优先配置`);
    const mm = marginModel(a);
    if (mm) {
      if (mm.discount < 1)
        r.push(`价格打了 ${(mm.discount * 10).toFixed(1)} 折：作为一篮子好公司，现在比它的「合理价」便宜约 ${Math.round((1 - mm.discount) * 100)}%`);
      else
        r.push(`现在价格比「合理价」贵约 ${Math.round((mm.discount - 1) * 100)}%（还没到打折的时候）`);
    }
    if (a.dividendYield && a.dividendYield > DEPOSIT_RATE)
      r.push(`每年分红比存款多：股息率 ${a.dividendYield}% 比银行定存 ${DEPOSIT_RATE}% 还高`);
    else if (a.dividendYield)
      r.push(`每年分红约 ${a.dividendYield}%（银行定存 ${DEPOSIT_RATE}%）`);
    if (a.valuationPct != null) {
      if (a.valuationPct < 40) r.push(`现在估值便宜：处于历史偏低分位（${a.valuationPct}%），比大部分时候都划算`);
      else if (a.valuationPct > 60) r.push(`注意：短期看估值已经偏贵（分位 ${a.valuationPct}%），不是全场最便宜`);
    }
    const vals = a.series.map(s => s.close), hi = Math.max(...vals);
    const off = Math.round((1 - a.current / hi) * 100);
    if (off > 3) r.push(`价格比过去几年最贵时低约 ${off}%`);
    if (a.key === 'gold') r.push(`黄金是避险资产，市场恐慌时往往更稳，能帮组合扛波动`);
    if (f) r.push(`场外基金，${f.min} 元起投，可以每月小额定投、摊低成本`);
    return r;
  }

  /* ---------------------------- 视图：首页 ---------------------------- */
  function renderHome() {
    const cards = ASSETS.map(a => {
      const p = assetPct(a), band = pctBand(p);
      const unit = a.unit ? ` ${a.unit}` : '';
      return `<div class="card click asset-card" data-asset="${a.key}">
        <div><span class="name">${a.name}</span><span class="code">${a.code}</span></div>
        <div class="price">${fmt(a.current)}${unit}</div>
        <div class="chg ${cls(a.chgPct)}">${pct(a.chgPct)} <span class="tiny">今日</span></div>
        ${sparkline(a.series.map(s => s.close))}
        <div class="row2">
          <span class="tiny">5年价格分位</span>
          <span class="pct-badge ${band.c}">${p.toFixed(0)}% · ${band.t}</span>
        </div>
      </div>`;
    }).join('');

    // 估值温度计（沪深300 真实 PE/PB 历史分位，来自 tdx）
    const hs = ASSETS.find(a => a.key === 'hs300');
    const hp = hs.valuationPct, hb = pctBand(hp); // 真实综合估值分位

    // 股债性价比（Fed模型，示例参数）
    const peSample = 13.2, eqYield = 1 / peSample * 100;
    const bondYield = 1.82;
    const erp = eqYield - bondYield;
    const fedLevel = erp > 4 ? '股票相对债券有吸引力' : erp > 2 ? '中性' : '债券更优';
    const fedColor = erp > 4 ? 'var(--down)' : erp > 2 ? 'var(--warn)' : 'var(--up)';
    const maxV = Math.max(eqYield, bondYield) * 1.15;

    // 家庭资产温度计（综合 5 大类资产的估值冷热）
    const T = familyTemp(), band = tempBand(T);
    const hero = `
    <div class="card thermo-hero click" data-go="lazy">
      <div class="th-main">
        <div class="th-label">家庭资产温度计</div>
        <div class="th-desc">综合 5 大类资产的估值冷热，给出一个 0–100° 的「配置温度」<br/><span class="tiny">沪深300/科创50 为通达信真实 PE/PB 分位（2023–2026），其余为示例</span></div>
        <div class="th-verdict">当前综合温度 <b style="color:${tempColor(T)}">${T}°C</b>，属于 <b>${band.label}</b> 区间，${band.advice}。</div>
        <div class="temp-bar"><div class="temp-marker" style="left:${T}%"></div></div>
        <div class="temp-scale"><span>0° 极冷</span><span>50°</span><span>100° 极热</span></div>
        <div class="th-hint">点击查看「懒人跟投清单」→</div>
      </div>
      <div class="th-chips">
        ${ASSETS.map(a => `<span class="th-chip ${a.valuationPct < 40 ? 'cheap' : a.valuationPct > 60 ? 'exp' : 'mid'}">${a.name} <b>${a.valuationPct}%</b></span>`).join('')}
      </div>
    </div>`;

    const view = `
    <div class="page-head">
      <div><h1>市场冷热总览</h1><div class="desc">一屏判断「现在能不能买」：资产水位 + 估值温度 + 股债性价比</div></div>
      <span class="data-note">● 沪深300 / 科创50 / 黄金为通达信真实数据 · 其余为示例</span>
    </div>

    ${hero}
    <div class="grid cols-5">${cards}</div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <h3>估值温度计 · 沪深300（真实 PE/PB 分位）</h3>
        <div class="cap">沪深300 真实 PE 分位 ${hs.pePct}% · PB 分位 ${hs.pbPct}%（tdx 2023–2026，共 37 个月）；综合估值分位 ${hp}%</div>
        <div class="gauge-wrap">
          ${gauge(hp)}
          <div class="gauge-val ${hb.c === 'exp' ? 'up' : hb.c === 'cheap' ? 'down' : ''}">${hp.toFixed(0)}<span style="font-size:16px">%</span></div>
          <div class="gauge-label">当前处于 <b>${hb.t}</b> 区间 · 区间 ${fmt(Math.min(...hs.series.map(s=>s.close)))} ~ ${fmt(Math.max(...hs.series.map(s=>s.close)))}</div>
        </div>
      </div>
      <div class="card">
        <h3>股债性价比（Fed 模型 · 示例参数）</h3>
        <div class="cap">股票盈利收益率(1/PE) − 10Y国债收益率 = 股权风险溢价(ERP)</div>
        <div class="fed-row"><span class="lab">沪深300盈利收益率</span>
          <div class="fed-bar-track"><div class="fed-bar-fill" style="width:${eqYield/maxV*100}%;background:var(--brand)"></div></div>
          <span class="num">${eqYield.toFixed(2)}%</span></div>
        <div class="fed-row"><span class="lab">10Y国债收益率</span>
          <div class="fed-bar-track"><div class="fed-bar-fill" style="width:${bondYield/maxV*100}%;background:var(--gold)"></div></div>
          <span class="num">${bondYield.toFixed(2)}%</span></div>
        <div style="margin-top:14px;padding:12px;background:var(--panel-2);border-radius:10px">
          <div class="tiny">股权风险溢价 ERP</div>
          <div style="font-size:22px;font-weight:800;color:${fedColor}">${erp.toFixed(2)}%</div>
          <div class="tiny" style="color:${fedColor}">结论：${fedLevel}</div>
        </div>
      </div>
    </div>

    <div class="section-title">快捷入口</div>
    <div class="grid cols-3">
      <div class="card click entry" data-go="dividend" style="position:relative">
        <div class="et">红利股 Top50</div><div class="es">按股息率 / 连续分红年数 / 分红率排序筛选</div>
        <span class="arrow">›</span></div>
      <div class="card click entry" data-go="margin" style="position:relative">
        <div class="et">安全边际测算</div><div class="es">分红贴现估算内在价值，算安全垫</div>
        <span class="arrow">›</span></div>
      <div class="card click entry" data-go="holdings" style="position:relative">
        <div class="et">我的持仓</div><div class="es">建仓成本 / 盈亏 / 分红再投复利</div>
        <span class="arrow">›</span></div>
    </div>`;
    setView(view);
    const heroEl = $('.thermo-hero'); if (heroEl) heroEl.onclick = () => navigate('lazy');
    $$('.asset-card').forEach(el => el.onclick = () => renderMacro(el.dataset.asset));
    $$('.entry').forEach(el => el.onclick = () => navigate(el.dataset.go));
  }

  /* ---------------------------- 视图：宏观资产 ---------------------------- */
  let macroKey = 'hs300';
  function renderMacro(key) { if (key) macroKey = key; const a = ASSETS.find(x => x.key === macroKey);
    const tabs = ASSETS.map(x => `<div class="tab ${x.real ? 'real' : ''} ${x.key === macroKey ? 'active' : ''}" data-k="${x.key}">${x.name}</div>`).join('');
    const vals = a.series.map(s => s.close);
    const p = assetPct(a), band = pctBand(p);
    const stats = [
      ['当前', fmt(a.current) + (a.unit ? ' ' + a.unit : '')],
      ['5年高', fmt(Math.max(...vals))],
      ['5年低', fmt(Math.min(...vals))],
      ['5年分位', p.toFixed(0) + '% · ' + band.t],
      ['区间年化', pct(annualized(vals))]
    ].map(([k, v]) => `<div class="m">${k}<b>${v}</b></div>`).join('');

    const view = `
    <div class="page-head">
      <div><h1>宏观资产 · 长期走势</h1><div class="desc">月线级别（2021–2026），看长期水位而非短期波动</div></div>
      <span class="data-note">${a.real ? '● ' + a.note : '○ ' + a.note}</span>
    </div>
    <div class="tabs">${tabs}</div>
    <div class="card chart-card">
      ${lineChart([{ values: vals, color: a.isYield ? 'var(--gold)' : 'var(--brand)', area: true }], a.series.map(s => s.date))}
      <div class="chart-meta">${stats}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>中长线视角解读（${a.name}）</h3>
      <div class="cap">价值投资关注「这个资产在历史上是贵还是便宜」。上图分位与stats可辅助判断当前处于周期的哪个位置；${a.isYield ? '收益率上行通常压制权益估值，是贴现率锚。' : '分位越低，长期安全边际通常越高。'}</div>
    </div>`;
    setView(view);
    $$('.tab').forEach(t => t.onclick = () => renderMacro(t.dataset.k));
  }

  /* ---------------------------- 视图：红利 Top50 ---------------------------- */
  const divState = { sort: 'score', dir: -1, onlyLong: false, onlyHigh: false };
  function renderDividend() {
    let rows = DIVIDEND_STOCKS.slice();
    if (divState.onlyLong) rows = rows.filter(r => r.consecutiveYears >= 10);
    if (divState.onlyHigh) rows = rows.filter(r => r.dividendYield >= 5);
    rows.sort((a, b) => (a[divState.sort] - b[divState.sort]) * divState.dir);

    const cols = [
      ['rank', '排名'], ['name', '股票'], ['code', '代码'], ['industry', '行业'],
      ['price', '现价'], ['dividendYield', '股息率'], ['consecutiveYears', '连续分红'],
      ['payoutRatio', '分红率'], ['pe', 'PE'], ['score', '综合评分']
    ];
    const head = cols.map(([k, t]) => `<th data-k="${k}">${t}${divState.sort === k ? (divState.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('');
    const body = rows.map(r => `<tr data-code="${r.code}">
      <td class="rank">${r.rank}</td><td><b>${r.name}</b></td><td><span class="tag">${r.code}</span></td>
      <td style="text-align:left">${r.industry}</td>
      <td>${fmt(r.price)}</td>
      <td class="dy-pill ${r.dividendYield >= 5 ? 'down' : ''}">${r.dividendYield.toFixed(1)}%</td>
      <td>${r.consecutiveYears}年</td><td>${r.payoutRatio}%</td><td>${r.pe}</td><td><b>${r.score.toFixed(1)}</b></td>
    </tr>`).join('');

    const view = `
    <div class="page-head">
      <div><h1>红利股 Top50</h1><div class="desc">连续稳定分红 + 高股息率，是价值/收息策略的核心池</div></div>
      <span class="data-note">○ 示例数据 · 演示排序/筛选形态</span>
    </div>
    <div class="card">
      <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <label style="font-size:13px;color:var(--ink-2)"><input type="checkbox" id="fLong" ${divState.onlyLong ? 'checked' : ''}> 连续分红 ≥ 10 年（格雷厄姆式稳健）</label>
        <label style="font-size:13px;color:var(--ink-2)"><input type="checkbox" id="fHigh" ${divState.onlyHigh ? 'checked' : ''}> 股息率 ≥ 5%</label>
        <span class="tiny">共 ${rows.length} 只 · 点击表头排序 · 点击行可放入安全边际测算</span>
      </div>
      <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
    setView(view);
    $$('thead th').forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      if (divState.sort === k) divState.dir *= -1; else { divState.sort = k; divState.dir = (k === 'name' || k === 'code' || k === 'industry') ? 1 : -1; }
      renderDividend();
    });
    $('#fLong').onchange = e => { divState.onlyLong = e.target.checked; renderDividend(); };
    $('#fHigh').onchange = e => { divState.onlyHigh = e.target.checked; renderDividend(); };
    $$('tbody tr').forEach(tr => tr.onclick = () => { marginSeed = tr.dataset.code; navigate('margin'); });
  }

  /* ---------------------------- 视图：安全边际 ---------------------------- */
  let marginSeed = DIVIDEND_STOCKS[0].code;
  function renderMargin() {
    const stock = DIVIDEND_STOCKS.find(s => s.code === marginSeed) || DIVIDEND_STOCKS[0];
    const options = DIVIDEND_STOCKS.map(s => `<option value="${s.code}" ${s.code === stock.code ? 'selected' : ''}>${s.name}（${s.code}）</option>`).join('');
    const view = `
    <div class="page-head">
      <div><h1>安全边际测算</h1><div class="desc">分红贴现(Gordon)估算内在价值，与现价比较算安全垫</div></div>
      <span class="data-note">○ 测算输入为示例 · 估值为方法论演示</span>
    </div>
    <div class="calc">
      <div class="card">
        <h3>参数</h3>
        <div class="field"><label>选择股票</label><select id="mStock">${options}</select></div>
        <div class="field"><label>当前股价（元）</label><input id="mPrice" type="number" value="${stock.price}"></div>
        <div class="field"><label>年度每股分红 DPS（元）</label><input id="mDps" type="number" value="${stock.dps}"></div>
        <div class="field"><label>预期分红增长率 g（%）</label><input id="mG" type="number" value="3"></div>
        <div class="field"><label>折现率 r = 无风险+风险溢价（%）</label><input id="mR" type="number" value="8"></div>
        <div class="field"><label>持有/永续（年，0=永续）</label><input id="mN" type="number" value="0"></div>
        <button class="btn" id="mCalc">计算安全边际</button>
      </div>
      <div class="card">
        <div id="mOut"></div>
      </div>
    </div>`;
    setView(view);
    $('#mStock').onchange = e => { marginSeed = e.target.value; renderMargin(); };
    $('#mCalc').onclick = computeMargin;
    computeMargin();
  }
  function computeMargin() {
    const price = +$('#mPrice').value, dps = +$('#mDps').value, g = +$('#mG').value / 100, r = +$('#mR').value / 100;
    const out = $('#mOut');
    if (r <= g) { out.innerHTML = `<div class="result-box">折现率需大于增长率，请调整参数。</div>`; return; }
    const g0 = 0; // 永续 Gordon：V = D1/(r-g), D1 = dps*(1+g)
    const V = dps * (1 + g) / (r - g);
    const margin = (V - price) / V * 100;
    let verdict, vcls;
    if (margin > 30) { verdict = '安全边际充足，可关注'; vcls = 'buy'; }
    else if (margin > 0) { verdict = '有一定安全边际，中性'; vcls = 'hold'; }
    else { verdict = '价格已高于估算内在价值'; vcls = 'sell'; }
    // 敏感性：V 随 r 变化
    const rs = []; for (let i = 4; i <= 12; i += 0.5) rs.push(i);
    const vs = rs.map(rr => dps * (1 + g) / (rr / 100 - g));
    const sens = lineChart(
      [{ values: vs, color: 'var(--brand)', area: true }],
      rs.map(x => x.toFixed(1) + '%'),
      { height: 220 }
    );
    out.innerHTML = `
      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div><div class="tiny">估算内在价值</div><div class="result-big">${fmt(V)} 元</div></div>
          <div style="text-align:right"><div class="tiny">安全边际</div><div class="result-big ${margin >= 0 ? 'down' : 'up'}">${pct(margin)}</div></div>
        </div>
        <div style="margin-top:10px"><span class="verdict ${vcls}">${verdict}</span></div>
        <div class="tiny" style="margin-top:10px">公式：V = DPS×(1+g) ÷ (r−g) ｜ 现价 ${fmt(price)} ｜ 贴现率 ${(r*100).toFixed(1)}% ｜ 增长 ${(g*100).toFixed(1)}%</div>
      </div>
      <div class="section-title" style="margin-top:18px">内在价值对折现率 r 的敏感性</div>
      <div class="card" style="box-shadow:none">${sens}<div class="legend"><span><i style="background:var(--brand)"></i>内在价值 V(r)</span><span class="tiny">r 越高，估值越低 —— 这是美债收益率影响个股定价的直观体现</span></div></div>`;
  }

  /* ---------------------------- 视图：我的持仓 ---------------------------- */
  const LS = 'vi_holdings_v1';
  function loadHoldings() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; } }
  function saveHoldings(h) { localStorage.setItem(LS, JSON.stringify(h)); }
  function renderHoldings() {
    let h = loadHoldings();
    const totalCost = h.reduce((s, x) => s + x.cost * x.shares, 0);
    const totalMV = h.reduce((s, x) => s + (x.curr || x.cost) * x.shares, 0);
    const pl = totalMV - totalCost, plp = totalCost ? pl / totalCost * 100 : 0;
    const body = h.length ? h.map(x => {
      const mv = (x.curr || x.cost) * x.shares, p = mv - x.cost * x.shares, pp = x.cost ? p / (x.cost * x.shares) * 100 : 0;
      return `<tr><td><b>${x.name}</b></td><td><span class="tag">${x.code}</span></td><td>${fmt(x.cost)}</td><td>${fmt(x.curr || x.cost)}</td>
        <td>${x.shares}</td><td>${fmt(mv)}</td><td class="${cls(p)}">${fmt(p)}</td><td class="${cls(pp)}">${pct(pp)}</td></tr>`;
    }).join('') : `<tr><td colspan="8" class="empty">还没有持仓，先在上方添加一笔（示例演示数据，不会上传）</td></tr>`;

    // 分红再投复利曲线（示例）
    const yieldAvg = h.length ? 4.0 : 4.0;
    const base = Math.max(totalMV, 100000);
    const months = 60; let reinv = [], plain = [];
    let vR = base, vP = base; const monthlyDiv = base * yieldAvg / 100 / 12;
    for (let i = 0; i < months; i++) {
      const drift = 1 + 0.004 * Math.sin(i / 9); // 示例价格漂移
      vP *= drift;
      vR = vR * drift + vR * yieldAvg / 100 / 12; // 分红再投
      reinv.push(+vR.toFixed(0)); plain.push(+vP.toFixed(0));
    }
    const proj = lineChart(
      [{ values: reinv, color: 'var(--down)', area: true }, { values: plain, color: 'var(--ink-3)' }],
      window.VIData.LABELS, { height: 280 }
    );

    const view = `
    <div class="page-head">
      <div><h1>我的持仓</h1><div class="desc">建仓成本、盈亏与分红再投的长期复利效应</div></div>
      <span class="data-note">○ 持仓本地保存 · 复利曲线为示例</span>
    </div>
    <div class="card">
      <div class="hold-form">
        <div class="field" style="margin:0"><label>名称</label><input id="hName" placeholder="如 长江电力"></div>
        <div class="field" style="margin:0"><label>代码</label><input id="hCode" placeholder="600900"></div>
        <div class="field" style="margin:0"><label>成本价</label><input id="hCost" type="number" placeholder="20.5"></div>
        <div class="field" style="margin:0"><label>股数</label><input id="hShares" type="number" placeholder="1000"></div>
        <div class="field" style="margin:0"><label>现价(可空)</label><input id="hCurr" type="number" placeholder="可选"></div>
        <button class="btn" id="hAdd">添加</button>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:10px">
        <div class="m">总成本<b>${fmt(totalCost)}</b></div>
        <div class="m">总市值<b>${fmt(totalMV)}</b></div>
        <div class="m">总盈亏<b class="${cls(pl)}">${fmt(pl)} (${pct(plp)})</b></div>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th>名称</th><th>代码</th><th>成本</th><th>现价</th><th>股数</th><th>市值</th><th>盈亏</th><th>收益率</th>
      </tr></thead><tbody>${body}</tbody></table></div>
    </div>
    <div class="section-title">分红再投 vs 不复权（示例复利曲线）</div>
    <div class="card chart-card">${proj}
      <div class="legend"><span><i style="background:var(--down)"></i>红利再投</span><span><i style="background:var(--ink-3)"></i>不复权</span>
      <span class="tiny">假设组合股息率 ${yieldAvg}% · 月度再投 · 时间 2021–2026</span></div>
    </div>`;
    setView(view);
    $('#hAdd').onclick = () => {
      const name = $('#hName').value.trim(), code = $('#hCode').value.trim();
      const cost = +$('#hCost').value, shares = +$('#hShares').value, curr = +$('#hCurr').value || null;
      if (!name || !code || !cost || !shares) { alert('请填写名称/代码/成本价/股数'); return; }
      const h2 = loadHoldings(); h2.push({ name, code, cost, shares, curr }); saveHoldings(h2); renderHoldings();
    };
  }

  /* ---------------------------- 视图：懒人跟投 ---------------------------- */
  function renderLazy() {
    const T = familyTemp(), band = tempBand(T);
    const recos = recommendations();
    const fundCards = recos.map(r => {
      const a = r.asset, f = r.fund;
      const reasons = buyReasons(a, r.rank === 1).map(t => `<li>${t}</li>`).join('');
      const yExceed = a.dividendYield && a.dividendYield > DEPOSIT_RATE;
      return `<div class="card fund-card">
        <div class="fc-head">
          <div><div class="fc-name">${f.name}</div><div class="fc-tag">${f.klass} · ${a.name}</div></div>
          <div class="fc-weight ${r.rank === 1 ? 'primary' : ''}">${r.weight}%</div>
        </div>
        <div class="fc-meta">
          <span class="tag">${f.code}</span>
          <span class="min-badge">${f.min}元起投</span>
          <span class="pct-badge ${a.valuationPct < 40 ? 'cheap' : a.valuationPct > 60 ? 'exp' : 'mid'}">估值分位 ${a.valuationPct}%</span>
        </div>
        <div class="fc-why">为什么是它：<b>${a.name}</b> 是当前温度最低的一类资产（估值分位 ${a.valuationPct}%），越冷越值得买。</div>
        <div class="bl-title">买入逻辑说明书（大白话）</div>
        <ul class="buy-logic">${reasons}</ul>
      </div>`;
    }).join('');

    const ex = recos[0];
    const exLine = `当前温度最低的是 <b>${ex.asset.name}</b>（估值分位 ${ex.asset.valuationPct}%），建议优先配置 <b>${ex.weight}%</b> 仓位到 ${ex.fund.name}。`;

    // 双模型对比：估值分位模型 vs 安全边际(8折)模型
    const mmRows = ASSETS.filter(a => a.pe != null).map(a => {
      const mm = marginModel(a);
      const zhe = mm.discount < 1 ? `打 ${(mm.discount * 10).toFixed(1)} 折` : `贵 ${Math.round((mm.discount - 1) * 100)}%`;
      const vcls = mm.discount < 1 ? 'down' : 'up';
      const vtxt = mm.discount < 1 ? '相对债券便宜，可定投' : '相对债券偏贵，谨慎';
      return `<tr>
        <td><b>${a.name}</b></td>
        <td class="pct-badge ${a.valuationPct < 40 ? 'cheap' : a.valuationPct > 60 ? 'exp' : 'mid'}">分位 ${a.valuationPct}%</td>
        <td>盈利收益率 ${mm.eqYield.toFixed(1)}% vs 国债 ${RISK_FREE}%</td>
        <td class="${vcls}">${zhe}</td>
        <td class="${vcls}">${vtxt}</td>
      </tr>`;
    }).join('');
    const compareBlock = `
    <div class="card" style="margin-top:16px">
      <h3>两种视角对照：为什么结论会不一样？</h3>
      <div class="cap">价值投资看估值有两条路：① <b>估值分位模型</b>——和自己的历史比，现在贵不贵；② <b>安全边际（8折）模型</b>——和「10年国债」比，股票相对债券划不划算。两者角度不同，结论可能相反。</div>
      <div class="table-wrap"><table><thead><tr><th>资产</th><th>估值分位模型</th><th>盈利收益率 vs 国债</th><th>安全边际(8折)模型</th><th>长期视角结论</th></tr></thead><tbody>${mmRows}</tbody></table></div>
      <div class="cap" style="margin-top:10px">例：沪深300 的估值分位偏高（近3年反弹后短期不便宜），但盈利收益率 6.9% 远高于 10年国债 1.69%，按「8折模型」相当于打了 <b>8.2 折</b>——也就是<b>短期看不便宜、长期看仍划算</b>。这正是指数定投「越跌越买、摊低成本」的逻辑基础。</div>
    </div>`;

    const view = `
    <div class="page-head">
      <div><h1>懒人跟投清单</h1><div class="desc">不搞复杂组合，按「当前温度最低的资产」直接给场外基金建议，10 元起投</div></div>
      <span class="data-note">● 沪深300/科创50 估值分位为通达信真实数据 · 黄金/标普500/美债/基金为示例</span>
    </div>

    <div class="card reco-summary">
      <div class="rs-left">
        <div class="rs-temp ${band.cls}">${T}<span>°C</span></div>
        <div class="rs-band">综合温度 · ${band.label}</div>
      </div>
      <div class="rs-right">
        <div class="rs-advice"><b>结论：</b>${band.advice}。</div>
        <div class="rs-logic">推荐逻辑：取<b>当前温度最低</b>的 ${recos.length} 类资产，映射为对应场外基金，按冷热程度分配仓位（越冷仓位越高）。</div>
        <div class="rs-example">示例：${exLine}</div>
      </div>
    </div>

    <div class="section-title">推荐基金（按温度从低到高）</div>
    <div class="grid cols-3">${fundCards}</div>

    ${compareBlock}

    <div class="card" style="margin-top:16px">
      <h3>这个清单怎么用</h3>
      <div class="cap">① 看顶部「综合温度」——越冷越该买，越热越该等。② 清单只给 2–3 只场外基金、10 元起投，适合每月定投摊低成本。③ 每只旁边的「买入逻辑说明书」用大白话解释为什么现在值得买，不写术语。④ 想看某类资产长期走势，可去「宏观资产走势」。</div>
    </div>`;
    setView(view);
  }

  /* ---------------------------- 路由 ---------------------------- */
  function setView(html) { $('#view').innerHTML = html; window.scrollTo(0, 0); }
  const routes = { home: renderHome, macro: renderMacro, dividend: renderDividend, margin: renderMargin, holdings: renderHoldings, lazy: renderLazy };
  function navigate(view) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    (routes[view] || renderHome)();
  }

  /* ---------------------------- 启动 ---------------------------- */
  function init() {
    $$('.nav-item').forEach(n => n.onclick = () => navigate(n.dataset.view));
    navigate('home');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
