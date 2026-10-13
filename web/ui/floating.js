// Floating panels: move by dragging the header, resize from any edge or corner. Geometry is saved per
// panel in localStorage (a per-viewer layout, separate from the theme settings) and kept inside the window.
"use strict";

const LAYOUT_KEY = 'spectra-layout';
const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const floats = {}; // id -> { node, defaults, minW, minH }

let layout = {};
try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') || {}; } catch {}
function saveLayout() { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {} }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// g: { x, y, w, h } in CSS px; h = null lets the panel size itself to its content
function applyGeometry(id) {
  const f = floats[id], g = { ...(layout[id] || f.defaults()) };
  g.w = clamp(g.w, f.minW, innerWidth - 16);
  if (g.h != null) g.h = clamp(g.h, f.minH, innerHeight - 16);
  const s = f.node.style;
  s.width = g.w + 'px';
  s.height = g.h == null ? '' : g.h + 'px';
  s.maxHeight = `calc(100vh - 16px)`;
  const h = g.h ?? f.node.offsetHeight;
  s.left = clamp(g.x, 8, innerWidth - g.w - 8) + 'px';
  s.top = clamp(g.y, 8, innerHeight - h - 8) + 'px';
}

// Shared pointer tracking for drag and resize: calls onMove(dx, dy, startRect), saves on release
function track(e, f, id, onMove) {
  if (e.button !== 0) return;
  e.preventDefault();
  const start = f.node.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  f.node.classList.add('dragging');
  const move = ev => {
    layout[id] = onMove(ev.clientX - x0, ev.clientY - y0, start);
    applyGeometry(id);
  };
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    f.node.classList.remove('dragging');
    saveLayout();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

function makeFloating(id, node, { defaults, minW, minH }) {
  const f = floats[id] = { node, defaults, minW, minH };
  // Height stays automatic until the user resizes it vertically
  const geom = () => layout[id] || f.defaults();

  node.querySelector('.float-head').addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const h = geom().h;
    track(e, f, id, (dx, dy, r) => ({ x: r.left + dx, y: r.top + dy, w: r.width, h }));
  });

  for (const dir of EDGES) {
    const edge = el('div', { className: 'float-edge e-' + dir });
    edge.addEventListener('pointerdown', e => track(e, f, id, (dx, dy, r) => {
      let { left: x, top: y, width: w, height: h } = r;
      const keepH = !dir.includes('n') && !dir.includes('s') ? geom().h : h;
      if (dir.includes('e')) w = Math.max(minW, r.width + dx);
      if (dir.includes('w')) { w = Math.max(minW, r.width - dx); x = r.right - w; }
      if (dir.includes('s')) h = Math.max(minH, r.height + dy);
      if (dir.includes('n')) { h = Math.max(minH, r.height - dy); y = r.bottom - h; }
      return { x, y, w, h: dir.includes('n') || dir.includes('s') ? h : keepH };
    }));
    node.append(edge);
  }
  applyGeometry(id);
}

function resetLayout() {
  layout = {};
  saveLayout();
  for (const id in floats) applyGeometry(id);
}

addEventListener('resize', () => { for (const id in floats) applyGeometry(id); });
