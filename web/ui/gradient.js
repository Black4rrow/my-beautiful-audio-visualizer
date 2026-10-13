// Custom gradient editor: a bar with one handle per colour stop, editing the active theme's `stops` in place.
// Click the bar to add a stop, drag a handle to move it, drag it down (or press Remove) to delete it.
"use strict";

const REMOVE_DRAG = 40; // px below the bar that removes the dragged stop
const MIN_STOPS = 2;

function gradientEditor(t) {
  let sel = 0;
  const bar = el('div', { className: 'grad-bar', title: 'Click to add a color' });
  const color = el('input', { type: 'color', id: 'gradColor', title: 'Color of the selected stop' });
  const remove = el('button', { className: 'btn grad-remove', textContent: 'Remove' });
  const hint = el('p', { className: 'hint', textContent: 'Click the bar to add a color · drag to move · drag down to remove' });

  // Updates colours and positions without rebuilding the handles, so a drag in progress is not interrupted
  function refresh() {
    bar.style.background = cssGradient('custom');
    [...bar.children].forEach((h, i) => {
      h.style.left = t.stops[i].p * 100 + '%';
      h.style.background = t.stops[i].c;
      h.classList.toggle('on', i === sel);
    });
    color.value = t.stops[sel].c;
    remove.disabled = t.stops.length <= MIN_STOPS;
    buildLUT();
    const chip = document.querySelector('.pal.on i');
    if (chip) chip.style.background = cssGradient('custom');
  }

  function rebuild() {
    bar.replaceChildren(...t.stops.map((_, i) => {
      const h = el('div', { className: 'grad-stop' });
      h.addEventListener('pointerdown', e => { e.stopPropagation(); drag(e, i); });
      return h;
    }));
    refresh();
  }

  function commit() { refresh(); renderDock(); save(); }

  function drag(e, i) {
    e.preventDefault();
    sel = i;
    refresh();
    const handle = bar.children[i];
    let removing = false;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = bar.getBoundingClientRect();
      t.stops[i].p = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      removing = t.stops.length > MIN_STOPS && ev.clientY - r.bottom > REMOVE_DRAG;
      handle.classList.toggle('removing', removing);
      refresh();
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      if (removing) { t.stops.splice(i, 1); sel = 0; rebuild(); }
      commit();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  // Adding takes the colour already shown at that spot, so the gradient doesn't change until it is edited
  bar.addEventListener('pointerdown', e => {
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    t.stops.push({ p, c: toHex(colorAt(positionedStops('custom'), p)) });
    rebuild();
    drag(e, t.stops.length - 1);
  });
  color.oninput = () => { t.stops[sel].c = color.value; commit(); };
  remove.onclick = () => {
    if (t.stops.length <= MIN_STOPS) return;
    t.stops.splice(sel, 1);
    sel = 0;
    rebuild(); commit();
  };

  rebuild();
  return el('div', { className: 'grad' }, bar, el('div', { className: 'grad-tools' }, color, remove), hint);
}
