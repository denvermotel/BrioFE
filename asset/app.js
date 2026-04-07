/**
 * BrioFE - Fatturazione Elettronica
 * app.js v0.04 alpha
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let lineCounter = 0;
const activeLines = new Set();
const BOLLO_ROW_ID = 'bollo-rivalsa-row';
let bolloManuallyDisabled = false;   /* true quando l'utente disattiva manualmente il bollo */
let cassaCounter = 0;
const activeCasse = new Set();

/* ─────────────────────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────────────────────── */
function escXml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function parseNum(s) {
  if (s == null || s === '') return 0;
  return parseFloat(String(s).replace(',', '.')) || 0;
}
function fmt(n, decimals = 2) { return parseFloat(n || 0).toFixed(decimals); }
function fmtIt(n, decimals = 2) {
  return parseFloat(n || 0).toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function countDecimals(s) {
  const str = String(s ?? '').replace(',', '.');
  const dot = str.indexOf('.');
  if (dot < 0) return 0;
  return str.length - dot - 1;
}
function priceInputFocus(id) {
  const inp = el(`price-${id}`);
  if (!inp) return;
  if (parseNum(inp.value) === 0) {
    inp.value = '';
    inp.classList.remove('input-suggested');
  }
}
function priceInputBlur(id) {
  const inp = el(`price-${id}`);
  if (!inp) return;
  if (inp.value === '' || parseNum(inp.value) === 0) {
    inp.value = '0';
    inp.classList.add('input-suggested');
  } else {
    inp.classList.remove('input-suggested');
  }
  recalcDecimals();
}

function recalcDecimals() {
  let priceDecimals = 2;
  let qtyDecimals   = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    const id = tr.id.replace('line-', '');
    const pv = el(`price-${id}`)?.value ?? '';
    const qv = el(`qty-${id}`)?.value ?? '';
    if (pv !== '') priceDecimals = Math.max(priceDecimals, countDecimals(pv));
    if (qv !== '') qtyDecimals   = Math.max(qtyDecimals,   countDecimals(qv));
  });
  const active = document.activeElement;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    const id = tr.id.replace('line-', '');
    const priceEl = el(`price-${id}`);
    const qtyEl   = el(`qty-${id}`);
    if (priceEl && priceEl !== active)
      priceEl.value = parseNum(priceEl.value).toFixed(priceDecimals);
    if (qtyEl && qtyEl !== active) {
      const v = parseNum(qtyEl.value);
      qtyEl.value = qtyDecimals > 0 ? v.toFixed(qtyDecimals) : String(Math.round(v));
    }
  });
}
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
function el(id) { return document.getElementById(id); }

function toast(msg, type = 'success', duration = 4000) {
  const container = el('toast-container');
  if (!container) return;
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span style="font-size:1.1em;font-weight:700">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => { div.style.opacity='0'; div.style.transform='translateX(20px)'; div.style.transition='.3s ease'; setTimeout(()=>div.remove(),300); }, duration);
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────── */
let navOpen = false;

function isDesktop() { return window.innerWidth >= 1024; }

function toggleNav() {
  navOpen = !navOpen;
  const nav    = el('side-nav');
  const body   = el('app-body');
  const header = document.querySelector('.app-header');

  if (isDesktop()) {
    /* Desktop: toggle between full width and collapsed tab strip */
    nav?.classList.toggle('collapsed', !navOpen);
    body?.classList.toggle('nav-collapsed', !navOpen);
    header?.classList.toggle('nav-collapsed', !navOpen);
  } else {
    /* Mobile: overlay slide-in */
    nav?.classList.toggle('open', navOpen);
  }
}

/* Handle resize: re-sync state between mobile/desktop */
window.addEventListener('resize', () => {
  const nav    = el('side-nav');
  const body   = el('app-body');
  const header = document.querySelector('.app-header');
  if (!nav) return;
  if (isDesktop()) {
    nav.classList.remove('open');
    if (navOpen) {
      nav.classList.remove('collapsed');
      body?.classList.remove('nav-collapsed');
      header?.classList.remove('nav-collapsed');
    } else {
      nav.classList.add('collapsed');
      body?.classList.add('nav-collapsed');
      header?.classList.add('nav-collapsed');
    }
  } else {
    nav.classList.remove('collapsed');
    body?.classList.remove('nav-collapsed');
    header?.classList.remove('nav-collapsed');
    nav.classList.toggle('open', navOpen);
  }
});

function navClick(link) {
  /* Aggiorna active link */
  document.querySelectorAll('.side-nav-link').forEach(l => l.classList.remove('active'));
  link.classList.add('active');
  /* Chiudi su mobile */
  if (window.innerWidth < 1024) toggleNav();
}

/* Evidenzia la voce di menu in base alla sezione visibile */
function updateActiveNav() {
  const sections = ['sec-anagrafica','sec-sdi','sec-intestazione','sec-righe','sec-totali','sec-riepilogo','sec-pagamento','sec-genera'];
  let current = sections[0];
  sections.forEach(id => {
    const anchor = el(id);
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      if (rect.top <= 80) current = id;
    }
  });
  document.querySelectorAll('.side-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === '#' + current);
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });

/* ─────────────────────────────────────────────────────────────
   PROGRESSIVO INVIO v2.0
   Formato: B T YY S NNNN C  (10 caratteri)
   B    = prefisso fisso BrioFE
   T    = tentativo invio (F=primo, G=1°reinvio, …, P=10°reinvio)
   YY   = anno fattura mod 100
   S    = serie IVA (0=nessuna, A–Z)
   NNNN = numero fattura zero-padded (0001–9999)
   C    = carattere di controllo Base-36 pesato
───────────────────────────────────────────────────────────── */
const _CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function computeChecksum(s9) {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (i + 1) * _CHARSET.indexOf(s9[i]);
  }
  return _CHARSET[(36 - (sum % 36)) % 36];
}

function parseNumeroFattura(raw, invoiceYear) {
  raw = (raw || '').trim();
  if (!raw) throw new Error('Numero fattura mancante');

  const m = raw.match(/^(\d+)(?:\/(.+))?$/);
  if (!m) throw new Error('Formato numero fattura non riconosciuto');

  const numPart = parseInt(m[1], 10);
  if (numPart < 1 || numPart > 9999) throw new Error('Numero fattura fuori range (1–9999)');

  if (!m[2]) return { nr: numPart, series: '0' };

  const suffix = m[2].trim().toUpperCase();

  if (/^[A-Z]$/.test(suffix)) return { nr: numPart, series: suffix };

  if (/^\d+$/.test(suffix)) {
    const sv = parseInt(suffix, 10);
    const yy = invoiceYear % 100;
    if (sv > 999 || sv === yy || sv === invoiceYear) return { nr: numPart, series: '0' };
    throw new Error(`Suffisso anno ambiguo: "${suffix}" non corrisponde all'anno fattura`);
  }

  throw new Error(`Suffisso non riconosciuto: "${suffix}"`);
}

function computeProgressivo() {
  const nrField = el('fattura-numero');
  const nrRaw   = (nrField?.value?.trim()) || (nrField?.placeholder?.trim()) || '';
  const data    = val('fattura-data');

  let invoiceYear = new Date().getFullYear();
  if (data) {
    const yr = parseInt(data.split('-')[0], 10);
    if (yr > 999) invoiceYear = yr;
  }
  const yy = String(invoiceYear).slice(-2);

  const tentativo = parseInt(val('tentativo-invio'), 10) || 1;
  if (tentativo < 1 || tentativo > 11) {
    toast('Tentativo invio fuori range (1–11)', 'error', 6000);
    return null;
  }
  const T = String.fromCharCode('F'.charCodeAt(0) + tentativo - 1);

  let parsed;
  try {
    parsed = parseNumeroFattura(nrRaw, invoiceYear);
    nrField?.classList.remove('is-invalid');
  } catch (err) {
    nrField?.classList.add('is-invalid');
    toast('Progressivo: ' + err.message, 'error', 6000);
    return null;
  }

  const S    = parsed.series;
  const NNNN = String(parsed.nr).padStart(4, '0');
  const body = ('B' + T + yy + S + NNNN).toUpperCase(); /* 9 chars */
  return body + computeChecksum(body);                   /* 10 chars */
}

function updateProgressivo() {
  const editCb = el('progressivo-edit');
  if (editCb && editCb.checked) return; /* manuale: non sovrascrivere */
  const field = el('progressivo-invio');
  if (!field) return;
  const v = computeProgressivo();
  if (v !== null) field.value = v;
}

function toggleProgressivoEdit() {
  const cb    = el('progressivo-edit');
  const field = el('progressivo-invio');
  if (!field) return;
  if (cb && cb.checked) {
    field.removeAttribute('readonly');
    field.dataset.editable = 'true';
    field.classList.remove('calc-input');
    field.focus();
    toast('Progressivo invio modificabile manualmente.', 'warning', 3000);
  } else {
    field.setAttribute('readonly', '');
    delete field.dataset.editable;
    field.classList.add('calc-input');
    updateProgressivo(); /* ricalcola */
  }
}

function stepTentativo(delta) {
  const f = el('tentativo-invio');
  if (!f) return;
  const v = Math.min(11, Math.max(1, (parseInt(f.value, 10) || 1) + delta));
  f.value = v;
  updateProgressivo();
}

/* ─────────────────────────────────────────────────────────────
   LINE MANAGEMENT
───────────────────────────────────────────────────────────── */
function addLine() {
  lineCounter++;
  const id = lineCounter;
  activeLines.add(id);

  const tbody = el('linee-body');
  const row   = document.createElement('tr');
  row.id      = `line-${id}`;
  row.draggable = true;
  row.innerHTML = `
    <td class="td-nr nr-cell drag-handle" title="Trascina per riordinare">⠿</td>
    <td class="td-desc">
      <input type="text" id="desc-${id}" placeholder="Descrizione del bene o servizio..." oninput="recalc()" required>
    </td>
    <td class="td-um">
      <input type="text" id="um-${id}" placeholder="pz">
    </td>
    <td class="td-qty">
      <input type="number" id="qty-${id}" class="input-qty" value="1" step="any" min="0" oninput="recalcLine(${id})" onblur="recalcDecimals()" required>
    </td>
    <td class="td-price">
      <input type="number" id="price-${id}" class="input-suggested" value="0.00" step="0.01" min="0" onfocus="priceInputFocus(${id})" oninput="recalcLine(${id})" onblur="priceInputBlur(${id})" required>
    </td>
    <td class="td-disc">
      <input type="number" id="disc-${id}" value="" step="0.01" min="0" max="100" oninput="recalcLine(${id})" placeholder="0">
    </td>
    <td class="td-iva">
      <select id="iva-${id}" onchange="recalcLine(${id});toggleNatura(${id})">
        <option value="22.00">22%</option>
        <option value="10.00">10%</option>
        <option value="5.00">5%</option>
        <option value="4.00">4%</option>
        <option value="0.00">0%</option>
      </select>
    </td>
    <td class="td-natura" id="natura-td-${id}">
      <select id="natura-${id}" style="display:none" onchange="recalc()">
        <option value="N1">N1 – Escluse art.15</option>
        <option value="N2.1">N2.1 – Non soggette artt. 7-7septies</option>
        <option value="N2.2">N2.2 – Non soggette altri casi</option>
        <option value="N3.1">N3.1 – Non imponibili esportazioni</option>
        <option value="N3.2">N3.2 – Non imponibili cessioni intra-UE</option>
        <option value="N3.3">N3.3 – Non imponibili cessioni San Marino</option>
        <option value="N3.4">N3.4 – Non imponibili operazioni assimilate</option>
        <option value="N3.5">N3.5 – Non imponibili dichiar. d'intento</option>
        <option value="N3.6">N3.6 – Non imponibili altri</option>
        <option value="N4">N4 – Esenti</option>
        <option value="N5">N5 – Regime del margine</option>
        <option value="N6.1">N6.1 – Inversione contabile settore edile</option>
        <option value="N6.2">N6.2 – Inversione contabile oro/argento</option>
        <option value="N6.3">N6.3 – Inversione contabile subappalto edile</option>
        <option value="N6.4">N6.4 – Inversione contabile cessione fabbricati</option>
        <option value="N6.5">N6.5 – Inversione contabile telefonia</option>
        <option value="N6.6">N6.6 – Inversione contabile prodotti elettronici</option>
        <option value="N6.7">N6.7 – Inversione contabile prestazioni comparto edile</option>
        <option value="N6.8">N6.8 – Inversione contabile GNL</option>
        <option value="N6.9">N6.9 – Inversione contabile altri casi</option>
        <option value="N7">N7 – IVA assolta in altro stato UE</option>
      </select>
    </td>
    <td class="td-rit" id="rit-td-${id}">
      <input type="checkbox" id="rit-${id}" onchange="onRitChange(${id})" title="Soggetta a ritenuta d'acconto">
    </td>
    <td class="td-cassa" id="cassa-td-${id}">
      <input type="checkbox" id="cassa-sel-${id}" onchange="onCassaChange(${id})" title="Riga assegnata alla cassa previdenziale">
    </td>
    <td class="td-tot td-calc" id="imponibile-${id}">0,00</td>
    <td class="td-del">
      <button type="button" class="btn-danger-outline" onclick="removeLine(${id})" title="Rimuovi riga">✕</button>
    </td>
  `;
  tbody.appendChild(row);
  _initRowDrag(row);
  renumberLines();
  recalcLine(id);
}

function removeLine(id) {
  const row = el(`line-${id}`);
  if (row) row.remove();
  activeLines.delete(id);
  renumberLines();
  recalc();
}

function renumberLines() {
  let n = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    n++;
    const nrCell = tr.querySelector('.nr-cell');
    if (nrCell) nrCell.textContent = n;
  });
}

function toggleNatura(id) {
  const ivaVal = parseFloat(el(`iva-${id}`)?.value || 22);
  const select = el(`natura-${id}`);
  if (select) select.style.display = (ivaVal === 0) ? '' : 'none';
}

function recalcLine(id) {
  const qty   = parseNum(el(`qty-${id}`)?.value);
  const price = parseNum(el(`price-${id}`)?.value);
  const disc  = parseNum(el(`disc-${id}`)?.value);
  const prezzoScontato = price * (1 - disc / 100);
  const imponibile     = qty * prezzoScontato;
  const cell = el(`imponibile-${id}`);
  if (cell) cell.textContent = fmtIt(imponibile);
  recalcDecimals();
  recalc();
}

/* ─────────────────────────────────────────────────────────────
   DRAG & DROP RIGHE
───────────────────────────────────────────────────────────── */
let _dragSrc = null;

function _initRowDrag(row) {
  row.addEventListener('dragstart', (e) => {
    _dragSrc = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.id);
    setTimeout(() => row.classList.add('drag-dragging'), 0);
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('drag-dragging');
    document.querySelectorAll('#linee-body tr').forEach(r => r.classList.remove('drag-over'));
    _dragSrc = null;
  });
  row.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (row === _dragSrc || row.id === BOLLO_ROW_ID) return;
    document.querySelectorAll('#linee-body tr').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('dragleave', () => {
    row.classList.remove('drag-over');
  });
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    row.classList.remove('drag-over');
    if (!_dragSrc || _dragSrc === row || row.id === BOLLO_ROW_ID) return;
    const tbody = el('linee-body');
    const rows  = Array.from(tbody.querySelectorAll('tr'));
    const srcIdx = rows.indexOf(_dragSrc);
    const tgtIdx = rows.indexOf(row);
    if (srcIdx < tgtIdx) tbody.insertBefore(_dragSrc, row.nextSibling);
    else                 tbody.insertBefore(_dragSrc, row);
    renumberLines();
    recalc();
  });
}

/* ─────────────────────────────────────────────────────────────
   CALCULATIONS
───────────────────────────────────────────────────────────── */
function buildIvaMap() {
  const map = {};
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) {
      const br = getBolloRivalsaData();
      if (!br) return;
      const key = `${fmt(br.aliquota)}|${br.natura}`;
      if (!map[key]) map[key] = { aliquota: br.aliquota, natura: br.natura, imponibile: 0, imposta: 0 };
      map[key].imponibile += br.imponibile;
      return;
    }
    const id    = tr.id.replace('line-', '');
    const qty   = parseNum(el(`qty-${id}`)?.value);
    const price = parseNum(el(`price-${id}`)?.value);
    const disc  = parseNum(el(`disc-${id}`)?.value);
    const iva   = parseFloat(el(`iva-${id}`)?.value || 22);
    const natura = (iva === 0) ? (el(`natura-${id}`)?.value || '') : '';
    const prezzoScontato = price * (1 - disc / 100);
    const imponibile     = qty * prezzoScontato;
    const ivaImporto     = imponibile * iva / 100;
    const key = `${fmt(iva)}|${natura}`;
    if (!map[key]) map[key] = { aliquota: iva, natura, imponibile: 0, imposta: 0 };
    map[key].imponibile += imponibile;
    map[key].imposta    += ivaImporto;
  });
  /* Contributi casse previdenziali */
  if (el('cassa-attiva')?.checked) {
    activeCasse.forEach(cid => {
      const aliq   = parseFloat(el(`cassa-iva-${cid}`)?.value || 0);
      const contr  = calcContributoCassa(cid);
      if (contr <= 0) return;
      const natura = (aliq === 0) ? (el(`cassa-natura-${cid}`)?.value || '') : '';
      const key    = `${fmt(aliq)}|${natura}`;
      if (!map[key]) map[key] = { aliquota: aliq, natura, imponibile: 0, imposta: 0 };
      map[key].imponibile += contr;
      map[key].imposta    += contr * aliq / 100;
    });
  }
  return map;
}

function recalc() {
  const ivaMap = buildIvaMap();
  let totImponibile = 0, totIVA = 0;
  Object.values(ivaMap).forEach(v => { totImponibile += v.imponibile; totIVA += v.imposta; });

  const totFattura      = totImponibile + totIVA;

  const ritenutaAttiva  = el('ritenuta-attiva')?.checked;
  const importoRitenuta = ritenutaAttiva ? calcImportoRitenuta() : 0;
  const totNetto        = totFattura - importoRitenuta;

  setCalc('tot-imponibile',       totImponibile);
  setCalc('tot-iva',              totIVA);
  setCalc('tot-fattura',          totFattura);
  setCalc('totale-pagare-amount', ritenutaAttiva ? totNetto : totFattura);

  const ritRow   = el('tot-ritenuta-row');
  const nettoRow = el('tot-netto-row');
  if (ritRow)   ritRow.style.display   = ritenutaAttiva ? '' : 'none';
  if (nettoRow) nettoRow.style.display = ritenutaAttiva ? '' : 'none';
  if (ritenutaAttiva) {
    setCalc('tot-ritenuta', importoRitenuta);
    setCalc('tot-netto',    totNetto);
  }

  updateRiepilogoIVA(ivaMap);
  syncPagamentoImporto(ritenutaAttiva ? totNetto : totFattura);
}

function setCalc(id, value) {
  const elem = el(id);
  if (elem) elem.textContent = fmtIt(value) + ' €';
}

function syncPagamentoImporto(total) {
  const impEl = el('pagamento-importo');
  if (impEl) impEl.value = fmt(total);
}

function updateRiepilogoIVA(ivaMap) {
  const tbody = el('riepilogo-iva-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const entries = Object.values(ivaMap).filter(v => Math.abs(v.imponibile) > 0.001);
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="riepilogo-empty">Nessuna riga inserita</td></tr>`;
    return;
  }
  entries.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtIt(v.imponibile)} €</td><td>${fmt(v.aliquota)}%${v.natura?' ('+v.natura+')':''}</td><td>${fmtIt(v.imposta)} €</td>`;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────────────────────────────
   RITENUTA D'ACCONTO
───────────────────────────────────────────────────────────── */
function toggleRitenutaSection() {
  const attiva  = el('ritenuta-attiva')?.checked;
  const dettaglio = el('ritenuta-dettaglio');
  if (dettaglio) dettaglio.style.display = attiva ? 'block' : 'none';
  recalc();
}

function anyRitenutaRowChecked() {
  return Array.from(document.querySelectorAll('#linee-body tr')).some(tr => {
    if (tr.id === BOLLO_ROW_ID) return el('rit-bollo')?.checked;
    return el(`rit-${tr.id.replace('line-', '')}`)?.checked;
  });
}

/* Auto-abilita/disabilita ritenuta quando il checkbox di riga cambia */
function onRitChange(id) {
  const isChecked = el(`rit-${id}`)?.checked;
  if (isChecked && !el('ritenuta-attiva')?.checked) {
    const chk = el('ritenuta-attiva');
    if (chk) { chk.checked = true; toggleRitenutaSection(); return; }
  }
  if (!isChecked && el('ritenuta-attiva')?.checked && !anyRitenutaRowChecked()) {
    const chk = el('ritenuta-attiva');
    if (chk) { chk.checked = false; toggleRitenutaSection(); return; }
  }
  recalc();
}

function anyCassaRowChecked() {
  return Array.from(document.querySelectorAll('#linee-body tr')).some(tr => {
    if (tr.id === BOLLO_ROW_ID) return el('cassa-sel-bollo')?.checked;
    return el(`cassa-sel-${tr.id.replace('line-', '')}`)?.checked;
  });
}

function onCassaChange(id) {
  const isChecked = el(`cassa-sel-${id}`)?.checked;
  if (isChecked && !el('cassa-attiva')?.checked) {
    const chk = el('cassa-attiva');
    if (chk) { chk.checked = true; toggleCassaSection(); return; }
  }
  if (!isChecked && el('cassa-attiva')?.checked && !anyCassaRowChecked()) {
    const chk = el('cassa-attiva');
    if (chk) { chk.checked = false; toggleCassaSection(); return; }
  }
  recalc();
}

function onRitBolloChange() {
  const isChecked = el('rit-bollo')?.checked;
  if (isChecked && !el('ritenuta-attiva')?.checked) {
    const chk = el('ritenuta-attiva');
    if (chk) { chk.checked = true; toggleRitenutaSection(); return; }
  }
  if (!isChecked && el('ritenuta-attiva')?.checked && !anyRitenutaRowChecked()) {
    const chk = el('ritenuta-attiva');
    if (chk) { chk.checked = false; toggleRitenutaSection(); return; }
  }
  recalc();
}

function onCassaBolloChange() {
  const isChecked = el('cassa-sel-bollo')?.checked;
  if (isChecked && !el('cassa-attiva')?.checked) {
    const chk = el('cassa-attiva');
    if (chk) { chk.checked = true; toggleCassaSection(); return; }
  }
  if (!isChecked && el('cassa-attiva')?.checked && !anyCassaRowChecked()) {
    const chk = el('cassa-attiva');
    if (chk) { chk.checked = false; toggleCassaSection(); return; }
  }
  recalc();
}

function calcImportoRitenuta() {
  const aliq = parseNum(el('ritenuta-aliquota')?.value);
  let base = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) {
      if (el('rit-bollo')?.checked) base += parseNum(el('importo-bollo')?.value) || 2.00;
      return;
    }
    const id    = tr.id.replace('line-', '');
    if (!el(`rit-${id}`)?.checked) return;
    const qty   = parseNum(el(`qty-${id}`)?.value);
    const price = parseNum(el(`price-${id}`)?.value);
    const disc  = parseNum(el(`disc-${id}`)?.value);
    base += qty * price * (1 - disc / 100);
  });
  const importo = base * aliq / 100;
  const disp = el('ritenuta-importo-display');
  if (disp) disp.textContent = fmtIt(importo) + ' €';
  return importo;
}

/* ─────────────────────────────────────────────────────────────
   CASSE PREVIDENZIALI
───────────────────────────────────────────────────────────── */
function toggleCassaSection() {
  const attiva = el('cassa-attiva')?.checked;
  const dettaglio = el('cassa-dettaglio');
  if (dettaglio) dettaglio.style.display = attiva ? 'block' : 'none';
  if (attiva && activeCasse.size === 0) addCassaRow();
  recalc();
}

function getCassaImponibileRighe() {
  let tot = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    const id    = tr.id.replace('line-', '');
    const qty   = parseNum(el(`qty-${id}`)?.value);
    const price = parseNum(el(`price-${id}`)?.value);
    const disc  = parseNum(el(`disc-${id}`)?.value);
    tot += qty * price * (1 - disc / 100);
  });
  return tot;
}

function calcContributoCassa(cid) {
  const alc   = parseNum(el(`cassa-al-${cid}`)?.value);
  const impEl = el(`cassa-imponibile-${cid}`);
  let imp;
  if (impEl?.dataset.manuallyEdited === '1') {
    imp = parseNum(impEl.value);
  } else {
    /* Usa righe marcate con checkbox cassa; se nessuna, usa tutto il totale righe */
    const fromRows = getCassaImponibileFromRows();
    imp = fromRows > 0 ? fromRows : getCassaImponibileRighe();
    /* Auto-compila il campo imponibile con il valore calcolato */
    if (impEl) { impEl.value = fmt(imp); impEl.classList.add('input-suggested'); }
  }
  const contr  = imp * alc / 100;
  const dispEl = el(`cassa-contributo-display-${cid}`);
  if (dispEl) dispEl.textContent = fmtIt(contr) + ' €';
  return contr;
}

function recalcCassa(cid) {
  calcContributoCassa(cid);
  const aliq  = parseFloat(el(`cassa-iva-${cid}`)?.value || 0);
  const natEl = el(`cassa-natura-td-${cid}`);
  if (natEl) natEl.style.display = (aliq === 0) ? '' : 'none';
  recalc();
}

function addCassaRow() {
  cassaCounter++;
  const cid   = cassaCounter;
  activeCasse.add(cid);
  const container = el('cassa-body');
  const row   = document.createElement('div');
  row.id      = `cassa-row-${cid}`;
  row.className = 'cassa-row-card';
  row.innerHTML = `
    <div class="cassa-row-top">
      <select id="cassa-tipo-${cid}" onchange="recalcCassa(${cid})">
        <option value="TC01">TC01 – Avvocati / Procuratori</option>
        <option value="TC02">TC02 – Dottori Commercialisti</option>
        <option value="TC03">TC03 – Geometri</option>
        <option value="TC04">TC04 – Ingegneri / Architetti</option>
        <option value="TC05">TC05 – Notariato</option>
        <option value="TC06">TC06 – Ragionieri / Periti comm.</option>
        <option value="TC07">TC07 – ENASARCO</option>
        <option value="TC08">TC08 – ENPACL (Consulenti lavoro)</option>
        <option value="TC09">TC09 – ENPAM (Medici)</option>
        <option value="TC10">TC10 – ENPAF (Farmacisti)</option>
        <option value="TC11">TC11 – ENPAV (Veterinari)</option>
        <option value="TC12">TC12 – ENPAIA (Agric.)</option>
        <option value="TC13">TC13 – Spedizionieri / Agenzie</option>
        <option value="TC14">TC14 – INPGI (Giornalisti)</option>
        <option value="TC15">TC15 – ONAOSI</option>
        <option value="TC16">TC16 – CASAGIT</option>
        <option value="TC17">TC17 – EPPI (Periti industriali)</option>
        <option value="TC18">TC18 – EPAP (Pluricategoriale)</option>
        <option value="TC19">TC19 – ENPAB (Biologi)</option>
        <option value="TC20">TC20 – ENPAPI (Infermieri)</option>
        <option value="TC21">TC21 – ENPAP (Psicologi)</option>
        <option value="TC22" selected>TC22 – INPS (Gest. Separata)</option>
      </select>
      <button type="button" class="btn-danger-outline" onclick="removeCassaRow(${cid})" title="Rimuovi cassa">✕</button>
    </div>
    <div class="cassa-row-fields">
      <label class="cassa-field">
        <span>Aliquota %</span>
        <input type="number" id="cassa-al-${cid}" value="4.00" step="0.01" min="0" max="100" oninput="recalcCassa(${cid})">
      </label>
      <label class="cassa-field cassa-field-imp">
        <span>Imponibile</span>
        <input type="number" id="cassa-imponibile-${cid}" step="0.01" min="0" class="input-suggested"
          oninput="this.dataset.manuallyEdited=this.value.trim()?'1':''; this.classList.toggle('input-suggested',!this.value.trim()); recalcCassa(${cid})">
      </label>
      <label class="cassa-field">
        <span>Contributo</span>
        <span class="calc-display" id="cassa-contributo-display-${cid}">0,00 €</span>
      </label>
      <label class="cassa-field">
        <span>IVA %</span>
        <select id="cassa-iva-${cid}" onchange="recalcCassa(${cid})">
          <option value="22.00">22%</option>
          <option value="10.00">10%</option>
          <option value="5.00">5%</option>
          <option value="4.00">4%</option>
          <option value="0.00">0%</option>
        </select>
      </label>
      <label class="cassa-field cassa-field-rit" title="Soggetta a ritenuta d'acconto">
        <span>Rit.</span>
        <input type="checkbox" id="cassa-rit-${cid}">
      </label>
      <label class="cassa-field" id="cassa-natura-td-${cid}" style="display:none">
        <span>Natura</span>
        <select id="cassa-natura-${cid}" onchange="recalc()">
          <option value="N2.2">N2.2</option>
          <option value="N4">N4</option>
          <option value="N1">N1</option>
        </select>
      </label>
    </div>
  `;
  container.appendChild(row);
  recalcCassa(cid);
}

function removeCassaRow(cid) {
  const row = el(`cassa-row-${cid}`);
  if (row) row.remove();
  activeCasse.delete(cid);
  recalc();
}

/* Somma imponibili delle righe con checkbox cassa-sel spuntato. */
function getCassaImponibileFromRows() {
  let tot = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    let rowChecked, rowImponibile;
    if (tr.id === BOLLO_ROW_ID) {
      rowChecked    = el('cassa-sel-bollo')?.checked;
      rowImponibile = parseNum(el('importo-bollo')?.value) || 2.00;
    } else {
      const id      = tr.id.replace('line-', '');
      rowChecked    = el(`cassa-sel-${id}`)?.checked;
      const qty     = parseNum(el(`qty-${id}`)?.value);
      const price   = parseNum(el(`price-${id}`)?.value);
      const disc    = parseNum(el(`disc-${id}`)?.value);
      rowImponibile = qty * price * (1 - disc / 100);
    }
    if (rowChecked) tot += rowImponibile;
  });
  return tot;
}

/* ─────────────────────────────────────────────────────────────
   BOLLO/RIVALSA
───────────────────────────────────────────────────────────── */
function handleBolloChange() {
  const si = el('bollo-si'), no = el('bollo-no');
  const dettaglio = el('bollo-dettaglio');
  if (si.checked) {
    bolloManuallyDisabled = false;  /* utente attiva manualmente: reset flag */
    si.closest('.checkbox-label')?.classList.add('checked');
    no.closest('.checkbox-label')?.classList.remove('checked');
    if (dettaglio) dettaglio.style.display = 'block';
    const warn = el('bollo-warning-obbligatorio');
    if (warn) warn.style.display = 'none';
  } else {
    bolloManuallyDisabled = true;   /* utente disattiva: rispettiamo la scelta */
    no.closest('.checkbox-label')?.classList.add('checked');
    si.closest('.checkbox-label')?.classList.remove('checked');
    if (dettaglio) dettaglio.style.display = 'none';
    removeBolloRivalsaRow();
    const rivSi = el('rivalsa-si'), rivNo = el('rivalsa-no');
    if (rivSi && rivNo) { rivSi.checked=false; rivNo.checked=true; rivSi.closest('.checkbox-label')?.classList.remove('checked'); rivNo.closest('.checkbox-label')?.classList.add('checked'); }
  }
  recalc();
}

function handleRivalsaBolloChange() {
  const si = el('rivalsa-si'), no = el('rivalsa-no');
  if (si.checked) {
    si.closest('.checkbox-label')?.classList.add('checked');
    no.closest('.checkbox-label')?.classList.remove('checked');
    addBolloRivalsaRow();
  } else {
    no.closest('.checkbox-label')?.classList.add('checked');
    si.closest('.checkbox-label')?.classList.remove('checked');
    removeBolloRivalsaRow();
  }
  recalc();
}

function addBolloRivalsaRow() {
  if (el(BOLLO_ROW_ID)) { updateBolloRivalsaRow(); return; }
  const amount = parseNum(el('importo-bollo')?.value) || 2.00;
  const tbody  = el('linee-body');
  const row    = document.createElement('tr');
  row.id       = BOLLO_ROW_ID;
  row.className = 'row-bollo-rivalsa';
  row.innerHTML = buildBolloRivalsaRowHTML(amount);
  tbody.appendChild(row);
  recalc();
}

function removeBolloRivalsaRow() {
  const row = el(BOLLO_ROW_ID);
  if (row) row.remove();
  recalc();
}

function updateBolloRivalsaRow() {
  const row = el(BOLLO_ROW_ID);
  if (!row) return;
  const amount      = parseNum(el('importo-bollo')?.value) || 2.00;
  const prevRit   = el('rit-bollo')?.checked || false;
  const prevCassa = el('cassa-sel-bollo')?.checked || false;
  row.innerHTML   = buildBolloRivalsaRowHTML(amount);
  if (prevRit)   { const r = el('rit-bollo');      if (r) r.checked = true; }
  if (prevCassa) { const c = el('cassa-sel-bollo'); if (c) c.checked = true; }
  recalc();
}

function buildBolloRivalsaRowHTML(amount) {
  return `
    <td class="td-nr nr-cell">🔒</td>
    <td class="td-desc">
      <span class="bollo-row-badge">⚑ AUTO</span>
      <span style="font-size:.82rem;color:#5A3A00;font-weight:600;margin-left:6px">Bollo su Fattura Elettronica</span>
    </td>
    <td class="td-um"><span class="locked-cell">—</span></td>
    <td class="td-qty"><span class="locked-cell">1</span></td>
    <td class="td-price"><span class="locked-cell">${fmt(amount)}</span></td>
    <td class="td-disc"><span class="locked-cell">—</span></td>
    <td class="td-iva"><span class="locked-cell">0%</span></td>
    <td class="td-natura"><span class="locked-cell" style="font-size:.75rem">N1 – Escluse art.15</span></td>
    <td class="td-rit"><input type="checkbox" id="rit-bollo" onchange="onRitBolloChange()" title="Riga bollo soggetta a ritenuta"></td>
    <td class="td-cassa"><input type="checkbox" id="cassa-sel-bollo" onchange="onCassaBolloChange()" title="Riga bollo assegnata alla cassa previdenziale"></td>
    <td class="td-tot td-calc">${fmtIt(amount)}</td>
    <td class="td-del" style="color:#FDDBA0;text-align:center;font-size:1rem">🔒</td>
  `;
}

function getBolloRivalsaData() {
  if (!el(BOLLO_ROW_ID)) return null;
  const amount = parseNum(el('importo-bollo')?.value) || 2.00;
  return { imponibile: amount, aliquota: 0, natura: 'N1', imposta: 0 };
}

/* ─────────────────────────────────────────────────────────────
   VALIDATION
───────────────────────────────────────────────────────────── */
function checkSdiLength(input) {
  if (!input) return;
  const len = input.value.replace(/\s/g, '').length;
  input.classList.toggle('is-invalid', len > 0 && len < 7);
}
function validateForm() {
  const errors = [];
  const required = [
    ['cedente-piva',         'P.IVA Cedente'],
    ['cedente-denominazione','Denominazione Cedente'],
    ['cedente-indirizzo',    'Indirizzo Cedente'],
    ['cedente-cap',          'CAP Cedente'],
    ['cedente-comune',       'Comune Cedente'],
    ['cliente-denominazione','Denominazione Cliente'],
    ['cliente-indirizzo',    'Indirizzo Cliente'],
    ['cliente-cap',          'CAP Cliente'],
    ['cliente-comune',       'Comune Cliente'],
    ['fattura-numero',       'Numero Fattura'],
    ['fattura-data',         'Data Fattura'],
    ['fattura-tipo',         'Tipo Documento'],
    ['pagamento-modalita',   'Modalità Pagamento'],
    ['pagamento-importo',    'Importo Pagamento'],
  ];
  required.forEach(([id, label]) => {
    const elem = el(id);
    if (!elem) return;
    if (!elem.value.trim()) { errors.push(`Il campo "${label}" è obbligatorio.`); elem.classList.add('is-invalid'); }
    else elem.classList.remove('is-invalid');
  });
  if (activeLines.size === 0) errors.push('Inserire almeno una riga nella fattura.');
  const piva = val('cedente-piva').replace(/\s/g,'');
  if (piva && !/^\d{11}$/.test(piva)) errors.push('La P.IVA del Cedente deve essere di 11 cifre numeriche.');
  const sdi = val('cedente-sdi').replace(/\s/g,'');
  checkSdiLength(el('cedente-sdi'));
  if (sdi && !/^[A-Z0-9]{7}$/i.test(sdi)) {
    errors.push('Il Codice SDI Destinatario deve essere esattamente 7 caratteri alfanumerici (es. 0000000).');
    el('cedente-sdi')?.classList.add('is-invalid');
  } else {
    el('cedente-sdi')?.classList.remove('is-invalid');
  }
  const iban = val('pagamento-iban').replace(/\s/g,'');
  if (iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/i.test(iban)) errors.push('L\'IBAN inserito non sembra valido.');
  let rowIndex = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    rowIndex++;
    const id   = tr.id.replace('line-', '');
    const desc = el(`desc-${id}`)?.value?.trim();
    if (!desc) errors.push(`Riga ${rowIndex}: la descrizione è obbligatoria.`);
    const iva = parseFloat(el(`iva-${id}`)?.value || 22);
    if (iva === 0 && !el(`natura-${id}`)?.value) errors.push(`Riga ${rowIndex}: selezionare la Natura per IVA 0%.`);
  });
  if (errors.length > 0) { errors.forEach(msg => toast(msg, 'error', 6000)); return false; }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   XML GENERATION
───────────────────────────────────────────────────────────── */
function generateXML() {
  if (!validateForm()) return;

  /* Controlla se il bollo sarebbe obbligatorio ma non è stato selezionato */
  const tot         = calcolaTotaleQualificante();
  const bolloNeeded = tot > SOGLIA_BOLLO;
  const bolloActive = el('bollo-si')?.checked;

  if (bolloNeeded && !bolloActive) {
    const bodyEl = el('bollo-warn-body');
    if (bodyEl) bodyEl.innerHTML =
      `Questa fattura presenta operazioni soggette a bollo virtuale ` +
      `(imponibile qualificante <strong>€${fmtIt(tot)}</strong> &gt; €77,47) ` +
      `ma il bollo <strong>non è stato applicato</strong>.<br><br>` +
      `Clicca <strong>OK — Genera comunque</strong> per procedere lo stesso, ` +
      `oppure <strong>Annulla</strong> per tornare al form e applicare il bollo.`;
    const overlay = el('bollo-warn-overlay');
    if (overlay) overlay.style.display = 'flex';
    return;
  }

  _doGenerateXML();
}

function closeBolloWarnModal() {
  const overlay = el('bollo-warn-overlay');
  if (overlay) overlay.style.display = 'none';
}

function confirmBolloWarnModal() {
  closeBolloWarnModal();
  _doGenerateXML();
}

function _doGenerateXML() {
  try {
    const xmlStr   = buildXML();
    const piva     = val('cedente-piva').replace(/\s/g,'');
    const prog     = (val('progressivo-invio') || computeProgressivo() || '').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,10);
    const filename = `IT${piva}_${prog}.xml`;
    downloadXML(xmlStr, filename);
    toast(`Fattura XML generata: ${filename}`, 'success', 5000);
  } catch(err) {
    console.error(err);
    toast('Errore durante la generazione XML: ' + err.message, 'error', 8000);
  }
}

function downloadXML(xmlStr, filename) {
  const blob = new Blob([xmlStr], { type: 'application/xml;charset=UTF-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function buildXML() {
  const pivaIt     = val('cedente-piva').replace(/\s/g,'');
  const cfCedente  = val('cedente-cf').replace(/\s/g,'');
  const denomCed   = val('cedente-denominazione');
  const regimeFisc = val('cedente-regime');
  const indCed     = val('cedente-indirizzo');
  const capCed     = val('cedente-cap');
  const comCed     = val('cedente-comune');
  const provCed    = val('cedente-provincia');
  const telCed     = val('cedente-tel');
  const emailCed   = val('cedente-email');

  const sdiCode    = (val('cedente-sdi').toUpperCase() || '0000000').padEnd(7,'0').substring(0,7) || '0000000';
  const pecDest    = val('cedente-pec');
  const progressivo = (val('progressivo-invio') || computeProgressivo() || '').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,10) || 'BF00A00';

  const pivaCliente = val('cliente-piva').replace(/\s/g,'');
  const cfCliente   = val('cliente-cf').replace(/\s/g,'');
  const denomCli    = val('cliente-denominazione');
  const nomeCli     = val('cliente-nome');
  const cognomeCli  = val('cliente-cognome');
  const indCli      = val('cliente-indirizzo');
  const capCli      = val('cliente-cap');
  const comCli      = val('cliente-comune');
  const provCli     = val('cliente-provincia');
  const nazCli      = val('cliente-nazione') || 'IT';

  const tipoDoc   = val('fattura-tipo');
  const dataFatt  = val('fattura-data');
  const nrFattEl  = el('fattura-numero');
  const nrFatt    = nrFattEl?.value?.trim() || nrFattEl?.placeholder?.trim() || '';
  const causale   = val('fattura-causale');
  const esigIVA   = val('fattura-esigibilita') || 'I';

  const ivaMap  = buildIvaMap();
  let totImponibile = 0, totIVA = 0;
  Object.values(ivaMap).forEach(v => { totImponibile += v.imponibile; totIVA += v.imposta; });

  const hasBolloSi   = el('bollo-si')?.checked;
  const bolloImporto = hasBolloSi ? parseNum(el('importo-bollo')?.value) : 0;

  const ritenutaAttiva  = el('ritenuta-attiva')?.checked;
  const tipoRit         = val('ritenuta-tipo');
  const aliqRit         = val('ritenuta-aliquota');
  const causaleRit      = val('ritenuta-causale');
  const importoRitenuta = ritenutaAttiva ? calcImportoRitenuta() : 0;
  const cassaAttiva     = el('cassa-attiva')?.checked;

  const totFattura = totImponibile + totIVA - importoRitenuta;

  const condPag  = val('pagamento-condizioni') || 'TP02';
  const modalPag = val('pagamento-modalita');
  const dataSc   = val('pagamento-scadenza');
  const impPag   = val('pagamento-importo') || fmt(totFattura);
  const iban     = val('pagamento-iban').replace(/\s/g,'');
  const bic      = val('pagamento-bic').replace(/\s/g,'');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<p:FatturaElettronica versione="FPR12" SistemaEmittente="BrioFE"\n`;
  xml += `  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"\n`;
  xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 https://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">\n`;

  xml += `  <FatturaElettronicaHeader>\n`;
  xml += `    <DatiTrasmissione>\n`;
  xml += `      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escXml(pivaIt)}</IdCodice></IdTrasmittente>\n`;
  xml += `      <ProgressivoInvio>${escXml(progressivo)}</ProgressivoInvio>\n`;
  xml += `      <FormatoTrasmissione>FPR12</FormatoTrasmissione>\n`;
  xml += `      <CodiceDestinatario>${escXml(sdiCode)}</CodiceDestinatario>\n`;
  if (pecDest) xml += `      <PECDestinatario>${escXml(pecDest)}</PECDestinatario>\n`;
  xml += `    </DatiTrasmissione>\n`;

  xml += `    <CedentePrestatore>\n`;
  xml += `      <DatiAnagrafici>\n`;
  xml += `        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escXml(pivaIt)}</IdCodice></IdFiscaleIVA>\n`;
  if (cfCedente) xml += `        <CodiceFiscale>${escXml(cfCedente)}</CodiceFiscale>\n`;
  xml += `        <Anagrafica><Denominazione>${escXml(denomCed)}</Denominazione></Anagrafica>\n`;
  xml += `        <RegimeFiscale>${escXml(regimeFisc)}</RegimeFiscale>\n`;
  xml += `      </DatiAnagrafici>\n`;
  xml += `      <Sede>\n`;
  xml += `        <Indirizzo>${escXml(indCed)}</Indirizzo>\n`;
  xml += `        <CAP>${escXml(capCed)}</CAP>\n`;
  xml += `        <Comune>${escXml(comCed)}</Comune>\n`;
  if (provCed) xml += `        <Provincia>${escXml(provCed.toUpperCase().substring(0,2))}</Provincia>\n`;
  xml += `        <Nazione>IT</Nazione>\n`;
  xml += `      </Sede>\n`;
  if (telCed || emailCed) {
    xml += `      <Contatti>\n`;
    if (telCed)   xml += `        <Telefono>${escXml(telCed)}</Telefono>\n`;
    if (emailCed) xml += `        <Email>${escXml(emailCed)}</Email>\n`;
    xml += `      </Contatti>\n`;
  }
  xml += `    </CedentePrestatore>\n`;

  xml += `    <CessionarioCommittente>\n`;
  xml += `      <DatiAnagrafici>\n`;
  if (pivaCliente) {
    xml += `        <IdFiscaleIVA><IdPaese>${escXml(nazCli)}</IdPaese><IdCodice>${escXml(pivaCliente)}</IdCodice></IdFiscaleIVA>\n`;
  }
  if (cfCliente) xml += `        <CodiceFiscale>${escXml(cfCliente)}</CodiceFiscale>\n`;
  xml += `        <Anagrafica>\n`;
  if (denomCli) xml += `          <Denominazione>${escXml(denomCli)}</Denominazione>\n`;
  else if (nomeCli || cognomeCli) { xml += `          <Nome>${escXml(nomeCli)}</Nome>\n`; xml += `          <Cognome>${escXml(cognomeCli)}</Cognome>\n`; }
  xml += `        </Anagrafica>\n`;
  xml += `      </DatiAnagrafici>\n`;
  xml += `      <Sede>\n`;
  xml += `        <Indirizzo>${escXml(indCli)}</Indirizzo>\n`;
  xml += `        <CAP>${escXml(capCli)}</CAP>\n`;
  xml += `        <Comune>${escXml(comCli)}</Comune>\n`;
  if (provCli) xml += `        <Provincia>${escXml(provCli.toUpperCase().substring(0,2))}</Provincia>\n`;
  xml += `        <Nazione>${escXml(nazCli)}</Nazione>\n`;
  xml += `      </Sede>\n`;
  xml += `    </CessionarioCommittente>\n`;
  xml += `  </FatturaElettronicaHeader>\n`;

  xml += `  <FatturaElettronicaBody>\n`;
  xml += `    <DatiGenerali>\n`;
  xml += `      <DatiGeneraliDocumento>\n`;
  xml += `        <TipoDocumento>${escXml(tipoDoc)}</TipoDocumento>\n`;
  xml += `        <Divisa>EUR</Divisa>\n`;
  xml += `        <Data>${escXml(dataFatt)}</Data>\n`;
  xml += `        <Numero>${escXml(nrFatt)}</Numero>\n`;
  if (ritenutaAttiva && tipoRit && importoRitenuta > 0) {
    xml += `        <DatiRitenuta>\n`;
    xml += `          <TipoRitenuta>${escXml(tipoRit)}</TipoRitenuta>\n`;
    xml += `          <ImportoRitenuta>${fmt(importoRitenuta)}</ImportoRitenuta>\n`;
    xml += `          <AliquotaRitenuta>${fmt(parseNum(aliqRit))}</AliquotaRitenuta>\n`;
    xml += `          <CausalePagamento>${escXml(causaleRit)}</CausalePagamento>\n`;
    xml += `        </DatiRitenuta>\n`;
  }
  if (hasBolloSi) {
    xml += `        <DatiBollo>\n`;
    xml += `          <BolloVirtuale>SI</BolloVirtuale>\n`;
    if (bolloImporto > 0) xml += `          <ImportoBollo>${fmt(bolloImporto)}</ImportoBollo>\n`;
    xml += `        </DatiBollo>\n`;
  }
  if (cassaAttiva) {
    activeCasse.forEach(cid => {
      const tipoCassa  = val(`cassa-tipo-${cid}`);
      const alCassa    = parseNum(el(`cassa-al-${cid}`)?.value);
      const contr      = calcContributoCassa(cid);
      const impCassaEl = el(`cassa-imponibile-${cid}`);
      const impCassa   = impCassaEl && impCassaEl.value.trim() !== '' ? parseNum(impCassaEl.value) : null;
      const ivaC       = parseNum(el(`cassa-iva-${cid}`)?.value);
      const ritC       = el(`cassa-rit-${cid}`)?.checked;
      const aliqIvaC   = parseFloat(el(`cassa-iva-${cid}`)?.value || 0);
      const naturaC    = (aliqIvaC === 0) ? (val(`cassa-natura-${cid}`) || '') : '';
      if (!tipoCassa) return;
      xml += `        <DatiCassaPrevidenziale>\n`;
      xml += `          <TipoCassa>${escXml(tipoCassa)}</TipoCassa>\n`;
      xml += `          <AlCassa>${fmt(alCassa)}</AlCassa>\n`;
      xml += `          <ImportoContributoCassa>${fmt(contr)}</ImportoContributoCassa>\n`;
      if (impCassa !== null) xml += `          <ImponibileCassa>${fmt(impCassa)}</ImponibileCassa>\n`;
      xml += `          <AliquotaIVA>${fmt(ivaC)}</AliquotaIVA>\n`;
      if (ritC) xml += `          <Ritenuta>SI</Ritenuta>\n`;
      if (naturaC) xml += `          <Natura>${escXml(naturaC)}</Natura>\n`;
      xml += `        </DatiCassaPrevidenziale>\n`;
    });
  }
  xml += `        <ImportoTotaleDocumento>${fmt(totFattura)}</ImportoTotaleDocumento>\n`;
  if (causale) {
    (causale.match(/.{1,200}/g) || []).forEach(p => { xml += `        <Causale>${escXml(p)}</Causale>\n`; });
  }
  xml += `      </DatiGeneraliDocumento>\n`;
  xml += `    </DatiGenerali>\n`;

  xml += `    <DatiBeniServizi>\n`;
  let lineNum = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    lineNum++;
    if (tr.id === BOLLO_ROW_ID) {
      const br = getBolloRivalsaData();
      if (!br) return;
      xml += `      <DettaglioLinee>\n`;
      xml += `        <NumeroLinea>${lineNum}</NumeroLinea>\n`;
      xml += `        <Descrizione>Bollo su Fattura Elettronica</Descrizione>\n`;
      xml += `        <Quantita>1.00000000</Quantita>\n`;
      xml += `        <PrezzoUnitario>${fmt(br.imponibile,8)}</PrezzoUnitario>\n`;
      xml += `        <PrezzoTotale>${fmt(br.imponibile,8)}</PrezzoTotale>\n`;
      xml += `        <AliquotaIVA>0.00</AliquotaIVA>\n`;
      xml += `        <Natura>N1</Natura>\n`;
      if (el('rit-bollo')?.checked) xml += `        <Ritenuta>SI</Ritenuta>\n`;
      xml += `      </DettaglioLinee>\n`;
      return;
    }
    const id    = tr.id.replace('line-', '');
    const desc  = el(`desc-${id}`)?.value?.trim() || '';
    const um    = el(`um-${id}`)?.value?.trim() || '';
    const qty   = parseNum(el(`qty-${id}`)?.value);
    const price = parseNum(el(`price-${id}`)?.value);
    const disc  = parseNum(el(`disc-${id}`)?.value);
    const iva   = parseFloat(el(`iva-${id}`)?.value || 22);
    const natura = (iva === 0) ? (el(`natura-${id}`)?.value || '') : '';
    const imponibile = qty * price * (1 - disc/100);
    xml += `      <DettaglioLinee>\n`;
    xml += `        <NumeroLinea>${lineNum}</NumeroLinea>\n`;
    xml += `        <Descrizione>${escXml(desc)}</Descrizione>\n`;
    if (qty !== 1 || um) xml += `        <Quantita>${fmt(qty,8).replace(/\.?0+$/,'') || '1'}</Quantita>\n`;
    if (um) xml += `        <UnitaMisura>${escXml(um)}</UnitaMisura>\n`;
    xml += `        <PrezzoUnitario>${fmt(price,8)}</PrezzoUnitario>\n`;
    if (disc > 0) { xml += `        <ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>${fmt(disc,2)}</Percentuale></ScontoMaggiorazione>\n`; }
    xml += `        <PrezzoTotale>${fmt(imponibile,8)}</PrezzoTotale>\n`;
    xml += `        <AliquotaIVA>${fmt(iva)}</AliquotaIVA>\n`;
    if (natura) xml += `        <Natura>${escXml(natura)}</Natura>\n`;
    if (el(`rit-${id}`)?.checked) xml += `        <Ritenuta>SI</Ritenuta>\n`;
    xml += `      </DettaglioLinee>\n`;
  });

  Object.values(ivaMap).forEach(v => {
    xml += `      <DatiRiepilogo>\n`;
    xml += `        <AliquotaIVA>${fmt(v.aliquota)}</AliquotaIVA>\n`;
    if (v.natura) xml += `        <Natura>${escXml(v.natura)}</Natura>\n`;
    xml += `        <ImponibileImporto>${fmt(v.imponibile)}</ImponibileImporto>\n`;
    xml += `        <Imposta>${fmt(v.imposta)}</Imposta>\n`;
    if (v.aliquota > 0) xml += `        <EsigibilitaIVA>${escXml(esigIVA)}</EsigibilitaIVA>\n`;
    xml += `      </DatiRiepilogo>\n`;
  });
  xml += `    </DatiBeniServizi>\n`;

  xml += `    <DatiPagamento>\n`;
  xml += `      <CondizioniPagamento>${escXml(condPag)}</CondizioniPagamento>\n`;
  xml += `      <DettaglioPagamento>\n`;
  xml += `        <ModalitaPagamento>${escXml(modalPag)}</ModalitaPagamento>\n`;
  if (dataSc) xml += `        <DataScadenzaPagamento>${escXml(dataSc)}</DataScadenzaPagamento>\n`;
  xml += `        <ImportoPagamento>${fmt(parseNum(impPag))}</ImportoPagamento>\n`;
  if (iban) xml += `        <IBAN>${escXml(iban)}</IBAN>\n`;
  if (bic)  xml += `        <BIC>${escXml(bic)}</BIC>\n`;
  xml += `      </DettaglioPagamento>\n`;
  xml += `    </DatiPagamento>\n`;

  xml += `  </FatturaElettronicaBody>\n`;
  xml += `</p:FatturaElettronica>\n`;
  return xml;
}

/* ─────────────────────────────────────────────────────────────
   AUTO-BOLLO
   Attiva automaticamente il bollo virtuale quando le righe
   in fattura soddisfano i criteri di obbligatorietà.
   Nature che richiedono bollo (se IVA=0 e importo > €77,47):
     N1, N2.1, N2.2, N3.5, N3.6, N4, N6.x (reverse charge senza IVA)
   Nature escluse: N3.1, N3.2, N3.3, N3.4, N5, N7
   Non si considera: Sez.5 (NB1/NB2/NB3) e Sez.6 (elenchi trimestrali)
───────────────────────────────────────────────────────────── */
const NATURE_BOLLO_OBBLIGATORIO = ['N1', 'N2.1', 'N2.2', 'N3.5', 'N3.6', 'N4'];
const SOGLIA_BOLLO = 77.47;
let prevBolloNecessario = false;

/* Verifica se una riga (per natura+IVA) è soggetta a bollo.
   La soglia di €77,47 si applica al TOTALE del documento, non per riga. */
function rigaSoggetaBollo(natura, aliquotaIva) {
  if (aliquotaIva !== 0) return false;
  if (NATURE_BOLLO_OBBLIGATORIO.includes(natura)) return true;
  if (natura && natura.startsWith('N6')) return true;   /* reverse charge senza IVA */
  return false;
}

/* Calcola il totale imponibile delle righe soggette a bollo (IVA=0 + natura idonea).
   Usato sia dal controllo automatico sia dalla verifica manuale. */
function calcolaTotaleQualificante() {
  let tot = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    const id     = tr.id.replace('line-', '');
    const qty    = parseNum(el(`qty-${id}`)?.value);
    const price  = parseNum(el(`price-${id}`)?.value);
    const disc   = parseNum(el(`disc-${id}`)?.value);
    const iva    = parseFloat(el(`iva-${id}`)?.value || 22);
    const natura = el(`natura-${id}`)?.value || '';
    if (rigaSoggetaBollo(natura, iva)) tot += qty * price * (1 - disc / 100);
  });
  return tot;
}

function verificaBolloManuale() {
  /* Verifica esplicita richiesta dall'utente: azzera i flag e riesegue il controllo */
  bolloManuallyDisabled = false;
  prevBolloNecessario   = false;
  checkAutoBollo();

  const tot        = calcolaTotaleQualificante();
  const necessario = tot > SOGLIA_BOLLO;
  const resultEl   = el('bollo-check-result');
  if (!resultEl) return;

  if (necessario) {
    resultEl.className = 'bollo-check-result bollo-check-si';
    resultEl.innerHTML = `<strong>Bollo obbligatorio</strong> — imponibile soggetto €${fmtIt(tot)} &gt; €77,47. Bollo impostato su <strong>Sì</strong>.`;
  } else {
    /* Bollo non dovuto: se è selezionato Sì, riportarlo su No */
    if (el('bollo-si')?.checked) {
      el('bollo-no').checked = true;
      el('bollo-si').checked = false;
      handleBolloChange();
    }
    resultEl.className = 'bollo-check-result bollo-check-no';
    resultEl.innerHTML = `<strong>Bollo non dovuto</strong> — nessuna condizione di obbligo rilevata per questa fattura.`;
  }
  resultEl.style.display = 'flex';
}

function checkAutoBollo() {
  /* Soglia sul TOTALE del documento, non per singola riga.
     Fonte: DPR 642/1972; D.M. 17.06.2014; Guida Tecnica Studio Genna mar.2026 */
  const totaleQualificante = calcolaTotaleQualificante();
  const bolloNecessario    = totaleQualificante > SOGLIA_BOLLO;

  /* Quando le condizioni passano da non-necessario → necessario,
     azzera il flag di disattivazione manuale così il bollo si riattiva. */
  if (bolloNecessario && !prevBolloNecessario) {
    bolloManuallyDisabled = false;
  }
  prevBolloNecessario = bolloNecessario;

  const warningEl = el('bollo-warning-obbligatorio');

  /* Utente ha disattivato manualmente: mostra/nascondi solo l'avviso */
  if (bolloManuallyDisabled) {
    if (warningEl) warningEl.style.display = bolloNecessario ? 'flex' : 'none';
    return;
  }

  if (warningEl) warningEl.style.display = 'none';

  if (!bolloNecessario || el('bollo-si')?.checked) return;

  /* Attiva automaticamente bollo SI */
  const si  = el('bollo-si');
  const no  = el('bollo-no');
  const det = el('bollo-dettaglio');
  if (!si || !no) return;
  si.checked = true;
  no.checked = false;
  si.closest('.checkbox-label')?.classList.add('checked');
  no.closest('.checkbox-label')?.classList.remove('checked');
  if (det) det.style.display = 'block';
  toast('Bollo virtuale attivato automaticamente: operazione soggetta a bollo (totale > €77,47). Puoi disattivarlo manualmente se non applicabile.', 'warning', 6000);
}


/* ─────────────────────────────────────────────────────────────
   IMPORT XML
───────────────────────────────────────────────────────────── */
let _pendingImportDoc  = null;
let _pendingImportMode = null;

/* Helper: testo del primo tag con quel nome nel nodo dato */
function xmlText(node, tagName) {
  if (!node) return '';
  const found = node.getElementsByTagName(tagName);
  return found.length > 0 ? found[0].textContent.trim() : '';
}

/* Apre il file picker, legge il file XML e chiama onLoaded(xmlDoc) */
function _openXmlFile(inputId, onLoaded) {
  const input = el(inputId);
  if (!input) return;
  input.value = '';
  const handler = () => {
    input.removeEventListener('change', handler);
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, 'application/xml');
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          toast('Il file XML non è valido o è corrotto.', 'error', 6000);
          return;
        }
        onLoaded(xmlDoc);
      } catch(err) {
        toast('Errore nella lettura del file: ' + err.message, 'error', 6000);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.addEventListener('change', handler);
  input.click();
}

function importXML() {
  _openXmlFile('file-import-full', (xmlDoc) => {
    _pendingImportDoc  = xmlDoc;
    _pendingImportMode = 'full';
    _showImportModal(
      'Importa fattura XML',
      `<div class="import-modal-warning">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span><strong>Attenzione:</strong> proseguendo, <strong>tutti i dati attualmente presenti nel form</strong> (cedente, cliente, righe fattura, dati di pagamento) verranno sovrascritti con i dati del file XML selezionato.<br><br>I campi non supportati da BrioFE in questa versione saranno ignorati.</span>
      </div>`,
      'Sovrascrivi e importa'
    );
  });
}

function importCedenteClienteXML() {
  _openXmlFile('file-import-header', (xmlDoc) => {
    _pendingImportDoc  = xmlDoc;
    _pendingImportMode = 'entrambi';
    _showImportModal(
      'Importa dati cedente / cliente',
      `<div class="import-modal-warning">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>I dati selezionati sovrascriveranno i campi corrispondenti nel form.<br><strong>Le righe fattura e i dati di pagamento non verranno modificati.</strong></span>
      </div>
      <div class="import-modal-checks">
        <label class="import-check-label">
          <input type="checkbox" id="import-check-cedente" checked>
          <span><strong>Dati Cedente / Prestatore</strong> — denominazione, P.IVA, C.F., regime fiscale, sede</span>
        </label>
        <label class="import-check-label">
          <input type="checkbox" id="import-check-cliente" checked>
          <span><strong>Dati Cliente / Cessionario</strong> — denominazione, P.IVA, C.F., sede, Codice SDI / PEC</span>
        </label>
      </div>`,
      'Importa selezionati'
    );
  });
}

function _showImportModal(title, bodyHtml, confirmLabel) {
  const overlay    = el('import-modal-overlay');
  const titleEl    = el('import-modal-title');
  const bodyEl     = el('import-modal-body');
  const confirmBtn = el('import-modal-confirm-btn');
  if (!overlay || !titleEl || !bodyEl || !confirmBtn) return;
  titleEl.textContent  = title;
  bodyEl.innerHTML     = bodyHtml;
  confirmBtn.textContent = confirmLabel;
  overlay.style.display = 'flex';
}

function closeImportModal() {
  const overlay = el('import-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  _pendingImportDoc  = null;
  _pendingImportMode = null;
}

function confirmImport() {
  if (!_pendingImportDoc) { closeImportModal(); return; }
  /* Se presenti le checkbox di selezione cedente/cliente, aggiorna modalità */
  const checkCed = el('import-check-cedente');
  const checkCli = el('import-check-cliente');
  if (checkCed && checkCli) {
    const wantCed = checkCed.checked;
    const wantCli = checkCli.checked;
    if (!wantCed && !wantCli) { toast('Selezionare almeno un\'opzione da importare.', 'warning'); return; }
    if (wantCed && wantCli)   _pendingImportMode = 'entrambi';
    else if (wantCed)         _pendingImportMode = 'cedente';
    else                      _pendingImportMode = 'cliente';
  }
  try {
    parseAndLoadXML(_pendingImportDoc, _pendingImportMode);
    closeImportModal();
  } catch(err) {
    toast('Errore durante l\'importazione: ' + err.message, 'error', 8000);
    console.error(err);
    closeImportModal();
  }
}

/* ─────────────────────────────────────────────────────────────
   Popola il form con i dati dell'XML FPR12.
   mode: 'full' | 'cedente' | 'cliente' | 'entrambi'
   - 'full'      → tutto (cedente, cliente, SDI, intestazione, righe, bollo, pagamento)
   - 'cedente'   → solo dati cedente (denominazione, P.IVA, CF, regime, sede)
   - 'cliente'   → solo dati cliente + codice SDI / PEC
   - 'entrambi'  → cedente + cliente + SDI/PEC
───────────────────────────────────────────────────────────── */
function parseAndLoadXML(xmlDoc, mode) {
  const setVal = (id, value) => {
    const e = el(id);
    if (e && value !== undefined && value !== null && value !== '') e.value = value;
  };
  const setSelect = (id, value) => {
    const e = el(id);
    if (!e || !value) return;
    const opt = Array.from(e.options).find(o => o.value === value);
    if (opt) e.value = opt.value;
  };

  const hasIgnored = [];

  /* ── CEDENTE ──────────────────────────────────────────── */
  if (mode === 'full' || mode === 'cedente' || mode === 'entrambi') {
    const cedente = xmlDoc.getElementsByTagName('CedentePrestatore')[0];
    if (cedente) {
      setVal('cedente-denominazione', xmlText(cedente, 'Denominazione'));
      const pivaCode = xmlText(cedente, 'IdCodice');
      if (pivaCode) setVal('cedente-piva', pivaCode);
      setVal('cedente-cf', xmlText(cedente, 'CodiceFiscale'));
      setSelect('cedente-regime', xmlText(cedente, 'RegimeFiscale'));
      const sede = cedente.getElementsByTagName('Sede')[0];
      if (sede) {
        setVal('cedente-indirizzo', xmlText(sede, 'Indirizzo'));
        setVal('cedente-cap',       xmlText(sede, 'CAP'));
        setVal('cedente-comune',    xmlText(sede, 'Comune'));
        setVal('cedente-provincia', xmlText(sede, 'Provincia'));
      }
      const contatti = cedente.getElementsByTagName('Contatti')[0];
      if (contatti) {
        setVal('cedente-tel',   xmlText(contatti, 'Telefono'));
        setVal('cedente-email', xmlText(contatti, 'Email'));
      }
    }
  }

  /* ── SDI / PEC ────────────────────────────────────────── */
  if (mode === 'full' || mode === 'cliente' || mode === 'entrambi') {
    const trasmissione = xmlDoc.getElementsByTagName('DatiTrasmissione')[0];
    if (trasmissione) {
      setVal('cedente-sdi', xmlText(trasmissione, 'CodiceDestinatario'));
      setVal('cedente-pec', xmlText(trasmissione, 'PECDestinatario'));
    }
  }

  /* ── CLIENTE ──────────────────────────────────────────── */
  if (mode === 'full' || mode === 'cliente' || mode === 'entrambi') {
    const cliente = xmlDoc.getElementsByTagName('CessionarioCommittente')[0];
    if (cliente) {
      const pivaCliEl = cliente.getElementsByTagName('IdFiscaleIVA')[0];
      if (pivaCliEl) setVal('cliente-piva', xmlText(pivaCliEl, 'IdCodice'));
      setVal('cliente-cf', xmlText(cliente, 'CodiceFiscale'));
      const anagrafica = cliente.getElementsByTagName('Anagrafica')[0];
      if (anagrafica) {
        setVal('cliente-denominazione', xmlText(anagrafica, 'Denominazione'));
        setVal('cliente-nome',          xmlText(anagrafica, 'Nome'));
        setVal('cliente-cognome',       xmlText(anagrafica, 'Cognome'));
      }
      const sede = cliente.getElementsByTagName('Sede')[0];
      if (sede) {
        setVal('cliente-indirizzo', xmlText(sede, 'Indirizzo'));
        setVal('cliente-cap',       xmlText(sede, 'CAP'));
        setVal('cliente-comune',    xmlText(sede, 'Comune'));
        setVal('cliente-provincia', xmlText(sede, 'Provincia'));
        const nazione = xmlText(sede, 'Nazione');
        if (nazione) {
          const nazSel = el('cliente-nazione');
          if (nazSel) {
            const opt = Array.from(nazSel.options).find(o => o.value === nazione);
            if (opt) nazSel.value = opt.value;
          }
        }
      }
    }
  }

  /* Modalità solo intestazione: fermiamo qui */
  if (mode !== 'full') {
    toast('Dati importati correttamente.', 'success', 4000);
    return;
  }

  /* ── INTESTAZIONE FATTURA ──────────────────────────────── */
  const datiGen = xmlDoc.getElementsByTagName('DatiGeneraliDocumento')[0];
  if (datiGen) {
    setSelect('fattura-tipo', xmlText(datiGen, 'TipoDocumento'));
    const dataRaw = xmlText(datiGen, 'Data');
    if (dataRaw) setVal('fattura-data', dataRaw);
    const numero = xmlText(datiGen, 'Numero');
    if (numero) {
      const nrEl = el('fattura-numero');
      if (nrEl) { nrEl.value = numero; nrEl.classList.remove('input-suggested'); }
    }
    /* Causale: può essere multipla, si uniscono */
    const causali = datiGen.getElementsByTagName('Causale');
    if (causali.length > 0) {
      setVal('fattura-causale', Array.from(causali).map(c => c.textContent.trim()).join(' '));
    }
    /* Bollo */
    const datiBollo = datiGen.getElementsByTagName('DatiBollo')[0];
    const bolloSI = datiBollo && xmlText(datiBollo, 'BolloVirtuale') === 'SI';
    const bSi = el('bollo-si'), bNo = el('bollo-no');
    if (bSi && bNo) {
      bSi.checked = bolloSI; bNo.checked = !bolloSI;
      bSi.closest('.checkbox-label')?.classList.toggle('checked', bolloSI);
      bNo.closest('.checkbox-label')?.classList.toggle('checked', !bolloSI);
      const det = el('bollo-dettaglio');
      if (det) det.style.display = bolloSI ? 'block' : 'none';
      if (bolloSI) {
        const importo = xmlText(datiBollo, 'ImportoBollo');
        if (importo) setVal('importo-bollo', importo);
        bolloManuallyDisabled = false;
      } else {
        bolloManuallyDisabled = true;
      }
    }
  }

  /* EsigibilitàIVA — primo valore trovato nei DatiRiepilogo */
  const esigEls = xmlDoc.getElementsByTagName('EsigibilitaIVA');
  if (esigEls.length > 0) setSelect('fattura-esigibilita', esigEls[0].textContent.trim());

  /* ── RIGHE FATTURA ────────────────────────────────────── */
  /* Rimuove tutte le righe esistenti */
  const tbody = el('linee-body');
  if (tbody) {
    Array.from(tbody.querySelectorAll('tr')).forEach(r => {
      if (r.id !== BOLLO_ROW_ID) r.remove();
    });
    removeBolloRivalsaRow();
    activeLines.clear();
    lineCounter = 0;
  }

  let importedLines = 0;
  let hasRivalsaRow = false;

  Array.from(xmlDoc.getElementsByTagName('DettaglioLinee')).forEach(linea => {
    const desc   = xmlText(linea, 'Descrizione');
    const natura = xmlText(linea, 'Natura');
    /* Salta la riga rivalsa bollo (generata automaticamente da BrioFE) */
    if (desc && desc.toLowerCase().includes('bollo') && natura === 'N1') {
      hasRivalsaRow = true;
      return;
    }

    addLine();
    const lid = lineCounter;

    const descEl  = el(`desc-${lid}`);
    const umEl    = el(`um-${lid}`);
    const qtyEl   = el(`qty-${lid}`);
    const priceEl = el(`price-${lid}`);
    const discEl  = el(`disc-${lid}`);
    const ivaEl   = el(`iva-${lid}`);
    const natEl   = el(`natura-${lid}`);

    if (descEl)  descEl.value  = desc;
    if (umEl)    umEl.value    = xmlText(linea, 'UnitaMisura');
    if (qtyEl)   qtyEl.value   = xmlText(linea, 'Quantita') || '1';
    if (priceEl) priceEl.value = xmlText(linea, 'PrezzoUnitario') || '0';

    const scontoEl = linea.getElementsByTagName('ScontoMaggiorazione')[0];
    if (scontoEl && xmlText(scontoEl, 'Tipo') === 'SC' && discEl) {
      discEl.value = xmlText(scontoEl, 'Percentuale') || '';
    }

    const aliquota = xmlText(linea, 'AliquotaIVA');
    if (aliquota !== '' && ivaEl) {
      const ivaNum = parseFloat(aliquota);
      const matchOpt = Array.from(ivaEl.options).find(o => Math.abs(parseFloat(o.value) - ivaNum) < 0.001);
      if (matchOpt) ivaEl.value = matchOpt.value;
      toggleNatura(lid);
    }

    if (natura && natEl) {
      const matchNat = Array.from(natEl.options).find(o => o.value === natura);
      if (matchNat) {
        natEl.value = matchNat.value;
      } else if (natura) {
        hasIgnored.push(`Natura "${natura}"`);
      }
    }

    /* Ritenuta per riga */
    if (xmlText(linea, 'Ritenuta') === 'SI') {
      const ritEl = el(`rit-${lid}`);
      if (ritEl) ritEl.checked = true;
    }

    recalcLine(lid);
    importedLines++;
  });

  /* Rivalsa bollo: se presente nell'XML, attiva il checkbox */
  if (hasRivalsaRow && el('bollo-si')?.checked) {
    const rivSi = el('rivalsa-si'), rivNo = el('rivalsa-no');
    if (rivSi && rivNo) {
      rivSi.checked = true; rivNo.checked = false;
      rivSi.closest('.checkbox-label')?.classList.add('checked');
      rivNo.closest('.checkbox-label')?.classList.remove('checked');
      addBolloRivalsaRow();
    }
  }
  /* Rit. sulla riga bollo (se precedentemente esportata) */
  if (hasRivalsaRow) {
    Array.from(xmlDoc.getElementsByTagName('DettaglioLinee')).forEach(linea => {
      const desc  = xmlText(linea, 'Descrizione');
      const natura = xmlText(linea, 'Natura');
      if (desc && desc.toLowerCase().includes('bollo') && natura === 'N1') {
        if (xmlText(linea, 'Ritenuta') === 'SI') {
          const r = el('rit-bollo'); if (r) r.checked = true;
        }
      }
    });
  }

  /* ── PAGAMENTO ────────────────────────────────────────── */
  const condPagEl = xmlDoc.getElementsByTagName('CondizioniPagamento')[0];
  if (condPagEl) setSelect('pagamento-condizioni', condPagEl.textContent.trim());
  const detPag = xmlDoc.getElementsByTagName('DettaglioPagamento')[0];
  if (detPag) {
    setSelect('pagamento-modalita', xmlText(detPag, 'ModalitaPagamento'));
    const dataSc = xmlText(detPag, 'DataScadenzaPagamento');
    if (dataSc) setVal('pagamento-scadenza', dataSc);
    const impPag = xmlText(detPag, 'ImportoPagamento');
    if (impPag) {
      const impEl = el('pagamento-importo');
      if (impEl) { impEl.value = impPag; }
    }
    setVal('pagamento-iban', xmlText(detPag, 'IBAN'));
    setVal('pagamento-bic',  xmlText(detPag, 'BIC'));
  }

  /* ── RITENUTA D'ACCONTO ──────────────────────────────── */
  const datiRit = datiGen?.getElementsByTagName('DatiRitenuta')[0];
  if (datiRit) {
    const ritAttivaEl = el('ritenuta-attiva');
    if (ritAttivaEl) { ritAttivaEl.checked = true; }
    const tipoRitV = xmlText(datiRit, 'TipoRitenuta');
    const alqRitV  = xmlText(datiRit, 'AliquotaRitenuta');
    const cauRitV  = xmlText(datiRit, 'CausalePagamento');
    setSelect('ritenuta-tipo',    tipoRitV);
    if (alqRitV) setVal('ritenuta-aliquota', alqRitV);
    setSelect('ritenuta-causale', cauRitV);
    toggleRitenutaSection();
  }

  /* ── CASSE PREVIDENZIALI ─────────────────────────────── */
  const cassaEls = datiGen ? Array.from(datiGen.getElementsByTagName('DatiCassaPrevidenziale')) : [];
  if (cassaEls.length > 0) {
    const cassaAttivaEl = el('cassa-attiva');
    if (cassaAttivaEl) cassaAttivaEl.checked = true;
    const cassaDetEl = el('cassa-dettaglio');
    if (cassaDetEl) cassaDetEl.style.display = 'block';
    /* Svuota eventuali righe precedenti */
    activeCasse.forEach(cid => { const r = el(`cassa-row-${cid}`); if (r) r.remove(); });
    activeCasse.clear();
    cassaEls.forEach(cassaEl => {
      addCassaRow();
      const cid = cassaCounter;
      setSelect(`cassa-tipo-${cid}`,   xmlText(cassaEl, 'TipoCassa'));
      const alcV  = xmlText(cassaEl, 'AlCassa');
      const impV  = xmlText(cassaEl, 'ImponibileCassa');
      const ivaV  = xmlText(cassaEl, 'AliquotaIVA');
      const ritV  = xmlText(cassaEl, 'Ritenuta');
      const natV  = xmlText(cassaEl, 'Natura');
      if (alcV) setVal(`cassa-al-${cid}`,         alcV);
      if (impV) setVal(`cassa-imponibile-${cid}`,  impV);
      if (ivaV) {
        const ivaEl = el(`cassa-iva-${cid}`);
        if (ivaEl) {
          const matchOpt = Array.from(ivaEl.options).find(o => Math.abs(parseFloat(o.value) - parseFloat(ivaV)) < 0.001);
          if (matchOpt) ivaEl.value = matchOpt.value;
        }
      }
      if (ritV === 'SI') { const ritEl = el(`cassa-rit-${cid}`); if (ritEl) ritEl.checked = true; }
      if (natV) setSelect(`cassa-natura-${cid}`, natV);
      recalcCassa(cid);
    });
  }

  recalc();
  updateProgressivo();

  const lineWord = importedLines === 1 ? 'riga' : 'righe';
  toast(`Fattura importata: ${importedLines} ${lineWord} caricate.`, 'success', 4000);
  if (hasIgnored.length > 0) {
    toast(`Campi ignorati (non supportati): ${hasIgnored.join(', ')}.`, 'warning', 7000);
  }
}

/* ─────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Data odierna come default */
  const today = new Date().toISOString().split('T')[0];
  const dataEl = el('fattura-data');
  if (dataEl && !dataEl.value) { dataEl.value = today; }

  /* Numero fattura: solo placeholder (grigio, cancellato al primo input) */
  const nrEl = el('fattura-numero');
  if (nrEl) {
    const annoCorrente = new Date().getFullYear();
    nrEl.placeholder = `1/${annoCorrente}`;
    /* Nessun value: l'utente vede il placeholder grigio e può scrivere subito */
  }

  /* Nav: aperto su desktop per default, chiuso su mobile */
  const nav    = el('side-nav');
  const body   = el('app-body');
  const header = document.querySelector('.app-header');
  if (isDesktop()) {
    navOpen = true;
    nav?.classList.remove('collapsed', 'open');
    body?.classList.remove('nav-collapsed');
    header?.classList.remove('nav-collapsed');
  } else {
    navOpen = false;
    nav?.classList.remove('open', 'collapsed');
    body?.classList.remove('nav-collapsed');
    header?.classList.remove('nav-collapsed');
    /* Mostra il disclaimer modal su mobile */
    const mobileDisc = el('mobile-disclaimer');
    if (mobileDisc) mobileDisc.style.display = 'flex';
  }

  /* Prima riga */
  addLine();

  /* Calcola progressivo iniziale (usa il placeholder come sorgente) */
  updateProgressivo();

  /* Rivalsa bollo default NO */
  const rivNo = el('rivalsa-no');
  if (rivNo) { rivNo.checked = true; rivNo.closest('.checkbox-label')?.classList.add('checked'); }


  /* Nav attivo iniziale */
  updateActiveNav();

  console.log('%cBrioFE v0.04beta — Fatturazione Elettronica', 'color:#009B8A;font-size:14px;font-weight:bold;');
});
