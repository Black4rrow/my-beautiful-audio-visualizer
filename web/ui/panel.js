// Settings panel: builds sliders/toggles from the param schemas, palette picker and reset buttons.
"use strict";

// One control from a schema entry, bound to obj[def.k]
function control(def, obj) {
  const { k, label, min, max, step } = def;
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
  body.append(el('h2', { textContent: 'Settings' }));

  body.append(el('h3', { textContent: 'Theme · ' + THEMES[S.theme].name }));
  for (const d of THEMES[S.theme].params) body.append(control(d, S[S.theme]));

  body.append(el('h3', { textContent: 'Palette' }));
  const pals = el('div', { className: 'pals' });
  for (const [key, pal] of Object.entries(PALETTES)) {
    const b = el('button', { className: 'pal' + (S.palette === key ? ' on' : '') },
      el('i', { style: `background:${cssGradient(key)}` }), pal.name);
    b.onclick = () => setPalette(key);
    pals.append(b);
  }
  body.append(pals);
  if (S.palette === 'custom') {
    const picker = k => {
      const i = el('input', { type: 'color', value: S[k] });
      i.oninput = () => { S[k] = i.value; buildLUT(); renderDock(); save(); };
      return i;
    };
    body.append(el('div', { className: 'colors' }, picker('c1'), picker('c2')));
  }

  body.append(el('h3', { textContent: 'General' }));
  for (const d of GLOBAL_PARAMS) body.append(control(d, S));

  const reset = el('button', { className: 'btn', textContent: 'Reset this theme' });
  reset.onclick = () => { S[S.theme] = structuredClone(DEFAULTS[S.theme]); save(); renderPanel(); };
  const resetAll = el('button', { className: 'btn', textContent: 'Reset everything', style: 'margin-top:8px' });
  resetAll.onclick = () => {
    const th = S.theme;
    S = structuredClone(DEFAULTS); S.theme = th;
    buildLUT(); save(); renderPanel(); renderDock();
  };
  body.append(reset, resetAll);

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
