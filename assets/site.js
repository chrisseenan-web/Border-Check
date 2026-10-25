/* Border Check: every page reads its numbers from the files in /data.
   Change a value in data/figures.csv and it updates everywhere,
   including the share cards. */
(function () {
  'use strict';

  // ---------- helpers ----------
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    var head = rows.shift().map(function (h) { return h.trim(); });
    return rows.map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
      return o;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function get(url, type) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' (' + r.status + ')');
      return type === 'json' ? r.json() : r.text();
    });
  }

  var DATA = {};
  function load() {
    return Promise.all([
      get('data/figures.csv'), get('data/series.csv'), get('data/myths.json', 'json'),
      get('data/updates.csv'), get('data/releases.csv')
    ]).then(function (res) {
      DATA.figuresList = parseCSV(res[0]);
      DATA.figures = {};
      DATA.figuresList.forEach(function (f) { DATA.figures[f.id] = f; });
      DATA.series = parseCSV(res[1]);
      DATA.myths = res[2];
      DATA.updates = parseCSV(res[3]).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      DATA.releases = parseCSV(res[4]);
      return DATA;
    });
  }

  // Fill {{id.column}} with values from figures.csv.
  function fill(str) {
    return String(str || '').replace(/\{\{\s*([\w]+)\.([\w]+)\s*\}\}/g, function (m, id, col) {
      var f = DATA.figures[id];
      if (!f || f[col] == null || f[col] === '') { console.warn('Missing figure', id, col); return '[' + id + '.' + col + ']'; }
      return f[col];
    });
  }
  function fillEsc(str) { return esc(fill(str)); }

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function niceDate(iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function lastUpdated() {
    return DATA.updates.length ? niceDate(DATA.updates[0].date) : '';
  }

  var COMPARE = {
    yes: ['yes', 'Comparable'],
    caution: ['caution', 'Compare with care'],
    no: ['no', 'Not comparable']
  };
  function badge(v) {
    var c = COMPARE[v] || COMPARE.caution;
    return '<span class="badge ' + c[0] + '">' + c[1] + '</span>';
  }

  var CADENCE_DAYS = { monthly: 35, quarterly: 100, annual: 380 };
  function checkStatus(f) {
    var days = CADENCE_DAYS[f.cadence] || 380;
    var last = new Date(f.last_checked + 'T00:00:00');
    var age = Math.floor((Date.now() - last.getTime()) / 86400000);
    return age > days ? { due: true, text: 'Check due', age: age } : { due: false, text: 'Up to date', age: age };
  }

  function stamp() {
    document.querySelectorAll('[data-last-updated]').forEach(function (n) { n.textContent = lastUpdated(); });
  }

  function showError(err) {
    var m = document.querySelector('main');
    var box = document.createElement('div');
    box.className = 'wrap section';
    box.innerHTML = '<div class="callout"><strong>The data could not be loaded.</strong> ' + esc(err.message) +
      '. If you opened this file directly from your computer, run a local web server instead (see README.md).</div>';
    m.prepend(box);
  }

  // ---------- share cards ----------
  function statHTML(s) {
    return '<div class="sc-stat ' + esc(s.side || 'level') + '"><div class="sc-big">' + fillEsc(s.big) +
      '</div><div class="sc-label">' + fillEsc(s.label) + '</div></div>';
  }

  function mythCard(m) {
    var d = document.createElement('div');
    d.className = 'share-card';
    d.innerHTML =
      '<div class="sc-top"><div class="sc-eyebrow">MYTH ' + m.number + ' OF 6 · NHS SCOTLAND VS ENGLAND</div>' +
      '<div class="sc-title">“' + fillEsc(m.myth) + '”</div>' +
      '<div class="sc-verdict">Verdict: ' + esc(m.verdict) + '. ' + esc(m.verdict_detail) + '</div></div>' +
      '<div class="sc-body"><div class="sc-lead">' + fillEsc(m.lead) + '</div>' +
      '<div class="sc-stats">' + m.card.map(statHTML).join('') + '</div>' +
      '<div class="sc-meaning"><b>What this means.</b> ' + fillEsc(m.meaning) + '</div>' +
      '<div class="sc-foot"><span>Figures checked ' + esc(lastUpdated()) + '. Sources and caveats: see the full page.</span><span>' + esc(siteName()) + '</span></div></div>';
    return d;
  }

  function summaryCard() {
    var s = DATA.myths.summary;
    function col(title, side, items) {
      return '<div style="display:flex;flex-direction:column;gap:14px"><div class="sc-col-title" style="color:' + (side === 'scotland' ? '#1E4E79' : '#A4470F') + '">' + esc(title) + '</div>' +
        items.map(function (i) { return statHTML({ big: i.big, label: i.label, side: side }); }).join('') + '</div>';
    }
    var d = document.createElement('div');
    d.className = 'share-card';
    d.innerHTML =
      '<div class="sc-top"><div class="sc-eyebrow">MYTH VS EVIDENCE · ' + esc(lastUpdated().toUpperCase()) + '</div>' +
      '<div class="sc-title">' + esc(s.title) + '</div>' +
      '<div style="font-size:28px;color:#D5DCE3">' + esc(s.answer) + '</div></div>' +
      '<div class="sc-body" style="gap:20px">' +
      '<div class="sc-grid">' + col('Scotland is ahead at the front door', 'scotland', s.scotland_ahead) + col('England is ahead on planned care', 'england', s.england_ahead) + '</div>' +
      '<div class="sc-meaning" style="margin-top:0">' + esc(s.bottom_line) + '</div>' +
      '<div class="sc-foot"><span>Measures differ between countries where noted on the site. Sources: IFS, Public Health Scotland, NHS England, ONS, NRS.</span><span>' + esc(siteName()) + '</span></div></div>';
    return d;
  }

  function siteName() {
    var m = document.querySelector('meta[name="site-name"]');
    return m ? m.content : 'Border Check';
  }

  function mountCard(frame, card) {
    frame.innerHTML = '';
    frame.appendChild(card);
    function fit() { card.style.transform = 'scale(' + (frame.clientWidth / 1080) + ')'; }
    fit();
    window.addEventListener('resize', fit);
  }

  function downloadCard(makeCard, filename, statusEl) {
    if (!window.html2canvas) { statusEl.textContent = 'The image tool did not load. Check your connection and try again.'; return; }
    statusEl.textContent = 'Preparing image…';
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;height:1350px';
    var card = makeCard();
    holder.appendChild(card);
    document.body.appendChild(holder);
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      return window.html2canvas(card, { width: 1080, height: 1350, scale: 1, backgroundColor: '#F3F5F7', useCORS: true });
    }).then(function (canvas) {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      statusEl.textContent = 'Saved ' + filename + '. If nothing downloaded, your browser or this preview blocked it; it works on the published site.';
    }).catch(function (e) {
      statusEl.textContent = 'Could not create the image: ' + e.message;
    }).then(function () { holder.remove(); });
  }

  // ---------- pages ----------
  function statBlock(i) {
    return '<div class="stat"><div class="big">' + fillEsc(i.big) + '</div><div class="label">' + fillEsc(i.label) + '</div></div>';
  }

  function renderHome() {
    var s = DATA.myths.summary;
    document.getElementById('home-split').innerHTML =
      '<div class="panel scotland"><h3>Scotland is ahead at the front door</h3>' + s.scotland_ahead.map(statBlock).join('') + '</div>' +
      '<div class="panel england"><h3>England is ahead on planned care</h3>' + s.england_ahead.map(statBlock).join('') + '</div>' +
      '<div class="panel level"><h3>Closer than you think</h3>' + s.level.map(statBlock).join('') + '</div>';
    document.getElementById('home-twist').innerHTML = '<strong>The social care twist.</strong> ' + fillEsc(s.twist);
    document.getElementById('home-bottom').textContent = s.bottom_line;
    document.getElementById('home-myths').innerHTML = DATA.myths.myths.map(function (m) {
      return '<a class="myth-card" href="myth.html#' + m.id + '"><span class="n">Myth ' + m.number + ' of 6</span>' +
        '<q>' + fillEsc(m.myth) + '</q><span class="verdict">' + esc(m.verdict) + '</span></a>';
    }).join('');
    var frame = document.getElementById('summary-frame');
    mountCard(frame, summaryCard());
    var st = document.getElementById('summary-status');
    document.getElementById('summary-download').addEventListener('click', function () {
      downloadCard(summaryCard, 'nhs-scotland-england-summary.png', st);
    });
  }

  function figureRows(ids) {
    return ids.map(function (id) {
      var f = DATA.figures[id];
      if (!f) return '';
      var ne = f.north_east ? '<span class="period">North East: ' + esc(f.north_east) + '</span>' : '';
      return '<tr><td>' + esc(f.measure) + '<span class="period">' + badge(f.comparable) + '</span></td>' +
        '<td class="val scotland">' + esc(f.scotland || 'n/a') + '<span class="period">' + esc(f.period_scotland) + '</span></td>' +
        '<td class="val england">' + esc(f.england || 'n/a') + '<span class="period">' + esc(f.period_england) + '</span>' + ne + '</td>' +
        '<td class="note">' + esc(f.note) + '</td></tr>';
    }).join('');
  }

  function sourcesFor(ids) {
    var seen = {}, out = [];
    ids.forEach(function (id) {
      var f = DATA.figures[id];
      if (f && f.source_url && !seen[f.source_url]) { seen[f.source_url] = 1; out.push(f); }
    });
    return out.map(function (f) {
      return '<li><a href="' + esc(f.source_url) + '" target="_blank" rel="noopener">' + esc(f.source_name) + '</a></li>';
    }).join('');
  }

  function seriesPoints(id) {
    return DATA.series.filter(function (r) { return r.series === id; })
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (r) { return { period: r.period, value: parseFloat(r.value) }; });
  }

  var CHARTS = {
    eng_rtt_18wk: { kind: 'line', title: 'England: patients waiting under 18 weeks', finding: 'Improving, but stuck around 65% since spring 2026, far from the 92% standard.', min: 50, max: 100, ticks: [50, 75, 100], ref: 92, refLabel: 'Standard 92%', unit: '%', color: 'var(--eng)', meta: 'NHS England referral-to-treatment, selected months' },
    scot_long_waits: { kind: 'bars', title: 'Scotland: waits over 52 weeks', finding: 'Down by almost two thirds since September 2025, though the fall had slowed by May 2026.', unit: 'n', color: 'var(--scot)', meta: 'Public Health Scotland, outpatient plus inpatient and day case' },
    scot_cancer_62: { kind: 'line', title: 'Scotland: cancer treated within 62 days', finding: 'Recovered to 72.6% after a record low, still well short of the 95% standard.', min: 50, max: 100, ticks: [50, 75, 100], ref: 95, refLabel: 'Standard 95%', unit: '%', color: 'var(--scot)', meta: 'Public Health Scotland, calendar quarters (Q4 = Oct to Dec)' },
    scot_ae_4hr: { kind: 'line', title: 'Scotland: A&E seen within 4 hours', finding: 'Hovering just under 70% at all sites, against a 95% standard.', min: 50, max: 100, ticks: [50, 75, 100], ref: 95, refLabel: 'Standard 95%', unit: '%', color: 'var(--scot)', meta: 'Public Health Scotland, all A&E sites, selected months' },
    health_premium: { kind: 'bars', title: 'Extra health spending per person in Scotland', finding: 'Scotland’s lead over England fell from 22% to 2%.', unit: '+%', color: 'var(--scot)', meta: 'IFS, compared with England' }
  };

  function chartCard(id) {
    var c = CHARTS[id];
    var box = document.createElement('figure');
    box.className = 'chart-card';
    box.style.margin = '0';
    box.innerHTML = '<h3>' + esc(c.title) + '</h3><p class="finding">' + esc(c.finding) + '</p><div class="plot"></div><figcaption class="meta">' + esc(c.meta) + '</figcaption>';
    var pts = seriesPoints(id);
    window.Charts[c.kind](box.querySelector('.plot'), pts, c);
    return box;
  }

  function renderMyth() {
    var list = DATA.myths.myths;
    function show() {
      var id = (location.hash || '#m1').slice(1);
      var idx = list.findIndex(function (m) { return m.id === id; });
      if (idx < 0) idx = 0;
      var m = list[idx];
      document.title = 'Myth ' + m.number + ': ' + m.short + ' · ' + siteName();
      document.getElementById('myth-eyebrow').textContent = 'Myth ' + m.number + ' of 6';
      document.getElementById('myth-quote').textContent = fill(m.myth);
      document.getElementById('myth-verdict').textContent = 'Verdict: ' + m.verdict + '. ' + m.verdict_detail;
      document.getElementById('myth-lead').textContent = fill(m.lead);
      document.getElementById('myth-points').innerHTML = m.points.map(function (p) { return '<li>' + fillEsc(p) + '</li>'; }).join('');
      document.getElementById('myth-meaning').innerHTML = '<strong>What this means.</strong> ' + fillEsc(m.meaning);
      document.getElementById('myth-caveat').innerHTML = '<strong>Caveat.</strong> ' + fillEsc(m.caveat);
      document.getElementById('myth-table').innerHTML = figureRows(m.figures);
      document.getElementById('myth-sources').innerHTML = sourcesFor(m.figures);
      var chartBox = document.getElementById('myth-chart');
      chartBox.innerHTML = '';
      chartBox.hidden = !m.chart;
      if (m.chart) chartBox.appendChild(chartCard(m.chart));
      mountCard(document.getElementById('myth-frame'), mythCard(m));
      var st = document.getElementById('myth-status');
      st.textContent = '';
      var btn = document.getElementById('myth-download');
      btn.onclick = function () { downloadCard(function () { return mythCard(m); }, 'nhs-myth-' + m.number + '.png', st); };
      var prev = list[(idx + list.length - 1) % list.length], next = list[(idx + 1) % list.length];
      document.getElementById('myth-pager').innerHTML =
        '<a class="btn secondary" href="#' + prev.id + '">← Myth ' + prev.number + '</a>' +
        '<a class="btn secondary" href="#' + next.id + '">Myth ' + next.number + ' →</a>';
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', show);
    show();
  }

  function renderDashboard() {
    var ids = ['gp_per_100k', 'ae_4hr', 'cancer_62', 'health_spend_per_head', 'social_care_spend', 'delayed_per_100k', 'life_exp_m', 'life_exp_f'];
    document.getElementById('dash-kpis').innerHTML = ids.map(function (id) {
      var f = DATA.figures[id];
      return '<div class="kpi"><div class="m">' + esc(f.measure) + '</div><div class="pair">' +
        '<span class="v scotland">' + esc(f.scotland || 'n/a') + '<small>Scot</small></span>' +
        '<span class="v england">' + esc(f.england || 'n/a') + '<small>Eng</small></span></div>' + badge(f.comparable) + '</div>';
    }).join('');
    var grid = document.getElementById('dash-charts');
    Object.keys(CHARTS).forEach(function (id) { grid.appendChild(chartCard(id)); });
  }

  function renderData() {
    var topics = [];
    DATA.figuresList.forEach(function (f) { if (topics.indexOf(f.topic) < 0) topics.push(f.topic); });
    var sel = document.getElementById('f-topic');
    sel.innerHTML = '<option value="">All topics</option>' + topics.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
    var q = document.getElementById('f-search'), cmp = document.getElementById('f-compare');
    function draw() {
      var term = q.value.toLowerCase(), t = sel.value, c = cmp.value;
      var rows = DATA.figuresList.filter(function (f) {
        return (!t || f.topic === t) && (!c || f.comparable === c) &&
          (!term || (f.measure + ' ' + f.note + ' ' + f.source_name).toLowerCase().indexOf(term) >= 0);
      });
      document.getElementById('data-count').textContent = rows.length + ' of ' + DATA.figuresList.length + ' figures';
      document.getElementById('data-table').innerHTML = rows.map(function (f) {
        var s = checkStatus(f);
        return '<tr><td>' + esc(f.measure) + '<span class="period">' + esc(f.topic) + '</span></td>' +
          '<td class="val scotland">' + esc(f.scotland || 'n/a') + '<span class="period">' + esc(f.period_scotland) + '</span></td>' +
          '<td class="val england">' + esc(f.england || 'n/a') + '<span class="period">' + esc(f.period_england) + '</span>' +
          (f.north_east ? '<span class="period">North East: ' + esc(f.north_east) + '</span>' : '') + '</td>' +
          '<td>' + badge(f.comparable) + '</td>' +
          '<td class="note">' + esc(f.note) + '<span class="period"><a href="' + esc(f.source_url) + '" target="_blank" rel="noopener">' + esc(f.source_name) + '</a></span></td>' +
          '<td><span class="badge ' + (s.due ? 'due' : 'ok') + '">' + s.text + '</span><span class="period">Checked ' + esc(niceDate(f.last_checked)) + '</span></td></tr>';
      }).join('');
    }
    [q, sel, cmp].forEach(function (n) { n.addEventListener('input', draw); });
    draw();
  }

  function renderUpdates() {
    document.getElementById('updates-log').innerHTML = DATA.updates.map(function (u) {
      return '<div class="log-item"><time datetime="' + esc(u.date) + '">' + esc(niceDate(u.date)) + '</time>' +
        '<div><span class="badge ' + (u.type === 'Correction' ? 'caution' : (u.type === 'To do' ? 'due' : 'yes')) + '">' + esc(u.type) + '</span></div>' +
        '<div>' + esc(u.summary) + '</div></div>';
    }).join('');
    document.getElementById('releases-table').innerHTML = DATA.releases.map(function (r) {
      var ids = r.figures.split(';').filter(Boolean);
      var due = ids.some(function (id) { return DATA.figures[id] && checkStatus(DATA.figures[id]).due; });
      return '<tr><td><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.publication) + '</a><span class="period">' + esc(r.publisher) + '</span></td>' +
        '<td>' + esc(r.country) + '</td><td>' + esc(r.cadence) + '<span class="period">' + esc(r.usual_timing) + '</span></td>' +
        '<td><span class="badge ' + (due ? 'due' : 'ok') + '">' + (due ? 'Check due' : 'Up to date') + '</span></td>' +
        '<td class="note">' + ids.map(function (id) { return DATA.figures[id] ? esc(DATA.figures[id].measure) : esc(id); }).join('; ') + '</td></tr>';
    }).join('');
  }

  var PAGES = { home: renderHome, myth: renderMyth, dashboard: renderDashboard, data: renderData, updates: renderUpdates, about: function () {} };

  document.addEventListener('DOMContentLoaded', function () {
    var pm = document.querySelector('meta[name="page"]');
    var page = document.body.getAttribute('data-page') || (pm ? pm.content : 'home');
    load().then(function () {
      stamp();
      (PAGES[page] || function () {})();
    }).catch(showError);
  });

  window.BorderCheck = { parseCSV: parseCSV, fill: fill, data: DATA };
})();
