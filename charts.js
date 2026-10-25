/* Small hand-drawn SVG charts. Every mark is placed with one scale, and
   colours come from the page's theme tokens so both themes read well. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function fmt(v, unit) {
    if (unit === '%') return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '') + '%';
    if (unit === '+%') return '+' + v + '%';
    return Number(v).toLocaleString('en-GB');
  }

  // Line chart with an optional reference line (a target or standard).
  function line(target, points, o) {
    var W = 560, H = 270, L = 44, R = 20, T = 18, B = 46;
    var min = o.min, max = o.max;
    var x = function (i) { return L + (points.length === 1 ? 0 : i * (W - L - R) / (points.length - 1)); };
    var y = function (v) { return T + (max - v) * (H - T - B) / (max - min); };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.title });
    var ticks = o.ticks || [min, (min + max) / 2, max];
    ticks.forEach(function (t) {
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), style: 'stroke:var(--line);stroke-width:1' }));
      svg.appendChild(el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px;font-family:var(--font-data)' }, t + (o.unit === '%' ? '%' : '')));
    });
    if (o.ref != null) {
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(o.ref), y2: y(o.ref), style: 'stroke:var(--ink-soft);stroke-width:1.5;stroke-dasharray:5 4' }));
      svg.appendChild(el('text', { x: W - R, y: y(o.ref) - 6, 'text-anchor': 'end', style: 'fill:var(--ink-soft);font-size:12px;font-weight:600' }, o.refLabel));
    }
    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.value); }).join(' ');
    svg.appendChild(el('path', { d: d, style: 'fill:none;stroke:' + o.color + ';stroke-width:2.5;stroke-linejoin:round' }));
    points.forEach(function (p, i) {
      var last = i === points.length - 1;
      var c = el('circle', { cx: x(i), cy: y(p.value), r: last ? 5.5 : 3.5, style: 'fill:' + (last ? o.color : 'var(--surface)') + ';stroke:' + o.color + ';stroke-width:2' });
      c.appendChild(el('title', {}, p.period + ': ' + fmt(p.value, o.unit)));
      svg.appendChild(c);
      if (last || i === 0) {
        svg.appendChild(el('text', { x: x(i), y: y(p.value) - 12, 'text-anchor': last ? 'end' : 'start', style: 'fill:var(--ink);font-size:13px;font-weight:700;font-family:var(--font-display)' }, fmt(p.value, o.unit)));
      }
      svg.appendChild(el('text', { x: x(i), y: H - B + 20, 'text-anchor': i === 0 ? 'start' : (last ? 'end' : 'middle'), style: 'fill:var(--muted);font-size:11px' }, p.period));
    });
    target.appendChild(svg);
  }

  // Bar chart measured from zero.
  function bars(target, points, o) {
    var W = 560, H = 270, L = 16, R = 16, T = 30, B = 40;
    var max = o.max || Math.max.apply(null, points.map(function (p) { return p.value; }));
    var band = (W - L - R) / points.length, bw = Math.min(90, band * 0.56);
    var y = function (v) { return T + (max - v) * (H - T - B) / max; };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.title });
    svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), style: 'stroke:var(--ink-soft);stroke-width:1' }));
    points.forEach(function (p, i) {
      var cx = L + band * i + band / 2, last = i === points.length - 1;
      var r = el('rect', { x: cx - bw / 2, y: y(p.value), width: bw, height: Math.max(1, y(0) - y(p.value)), rx: 3, style: 'fill:' + o.color + ';fill-opacity:' + (last ? 1 : 0.45) });
      r.appendChild(el('title', {}, p.period + ': ' + fmt(p.value, o.unit)));
      svg.appendChild(r);
      svg.appendChild(el('text', { x: cx, y: y(p.value) - 8, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:13px;font-weight:700;font-family:var(--font-display)' }, fmt(p.value, o.unit)));
      svg.appendChild(el('text', { x: cx, y: H - B + 20, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px' }, p.period));
    });
    target.appendChild(svg);
  }

  window.Charts = { line: line, bars: bars };
})();
