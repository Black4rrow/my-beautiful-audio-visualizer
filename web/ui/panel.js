// Settings panel for the active theme (its params, palette, rendering) plus app-wide settings, built from the schemas.
"use strict";

// One control from a schema entry, bound to obj[def.k]: a section title, a select, a toggle or a slider
function control(def, obj) {
  const { k, label, min, max, step } = def;
  if (def.section) return el('h4', { textContent: def.section });
  if (def.options) {
    const sel = el('select', { id: 'opt-' + k });
    for (const [value, text] of def.options) sel.append(el('option', { value, textContent: text }));
    sel.value = obj[k];
    sel.onchange = () => { obj[k] = sel.value; save(); };
    return el('div', { className: 'row' }, el('label', { className: 'lbl', htmlFor: sel.id }, label), sel);
  }
  if (typeof def.def === 'boolean') {
    const cb = el('input', { type: 'checkbox', checked: !!obj[k] });
    cb.onchange = () => { obj[k] = cb.checked; save(); };
    return el('div', { className: 'row' }, el('label', { className: 'toggle' }, label, cb));
  }
  const fmt = v => step >= 1 ? String(v) : Number(v).toFixed(2);
  const out = el('span', { textContent: fmt(obj[k]) });
  const r = el('input', { type: 'range', min, max, step, value: obj[k] });
  r.oninput = () => { obj[k] = +r.value; out.textContent = fmt(obj[k]); save(); };
  return el('div', { className: 'row' }, el('label', { className: 'lbl' }, label, out), r);
}

function renderPanel() {
  const body = $('#panelBody');
  body.innerHTML = '';
  body.append(el('p', { className: 'hint', textContent: `Saved for ${THEMES[S.theme].name} only. Each theme keeps its own settings.` }));
  const t = cur();

  body.append(el('h3', { textContent: 'Theme · ' + THEMES[S.theme].name }));
  for (const d of THEMES[S.theme].params) body.append(control(d, t));

  body.append(el('h3', { textContent: 'Palette' }));
  const pals = el('div', { className: 'pals' });
  for (const [key, pal] of Object.entries(PALETTES)) {
    const b = el('button', { className: 'pal' + (t.palette === key ? ' on' : '') },
      el('i', { style: `background:${cssGradient(key)}` }), pal.name);
    b.onclick = () => setPalette(key);
    pals.append(b);
  }
  body.append(pals);
  if (t.palette === 'custom') body.append(gradientEditor(t));

  body.append(el('h3', { textContent: 'Rendering' }));
  for (const d of SHARED_PARAMS) body.append(control(d, t));

  const reset = el('button', { className: 'btn', textContent: 'Reset this theme' });
  reset.onclick = () => { S[S.theme] = structuredClone(DEFAULTS[S.theme]); buildLUT(); save(); renderPanel(); renderDock(); };
  body.append(reset);

  body.append(el('h3', { textContent: 'All themes' }));
  for (const d of APP_PARAMS) body.append(control(d, S));
  const resetAll = el('button', { className: 'btn', textContent: 'Reset all themes', style: 'margin-top:8px' });
  resetAll.onclick = () => {
    const th = S.theme;
    S = structuredClone(DEFAULTS); S.theme = th;
    buildLUT(); save(); renderPanel(); renderDock();
  };
  const resetLayoutBtn = el('button', { className: 'btn', textContent: 'Reset panel positions', style: 'margin-top:8px' });
  resetLayoutBtn.onclick = resetLayout;
  body.append(resetAll, resetLayoutBtn);

  const keys = el('div', { className: 'keys' });
  keys.innerHTML = `<kbd>1</kbd>–<kbd>${THEME_KEYS.length}</kbd> theme · <kbd>P</kbd> palette · <kbd>S</kbd> settings<br>` +
                   '<kbd>F</kbd> fullscreen · <kbd>H</kbd> hide interface';
  body.append(keys);
}

function isPanelOpen() { return $('#panel').classList.contains('open'); }

function togglePanel() {
  $('#panel').classList.toggle('open');
  if (isPanelOpen()) renderPanel();
}

$('#panelClose').onclick = togglePanel;
makeFloating('panel', $('#panel'), {
  defaults: () => ({ x: innerWidth - 326, y: 16, w: 310, h: innerHeight - 32 }), minW: 240, minH: 200,
});
