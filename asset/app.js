/**
 * BrioFE - Fatturazione Elettronica
 * app.js v0.02 alpha
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let lineCounter = 0;
const activeLines = new Set();
const BOLLO_ROW_ID = 'bollo-rivalsa-row';
let bolloManuallyDisabled = false;   /* true quando l'utente disattiva manualmente il bollo */

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
   PROGRESSIVO INVIO
   Formato: BF + YY + lettera + 2 cifre
   es. fattura 121 del 2026 → BF26B21
───────────────────────────────────────────────────────────── */
function computeProgressivo() {
  const nrField = el('fattura-numero');
  const nrRaw   = (nrField?.value?.trim()) || (nrField?.placeholder?.trim()) || '';
  const data    = val('fattura-data');

  const digits = nrRaw.replace(/\D/g, '');
  const nr     = parseInt(digits, 10) || 0;

  let yy = new Date().getFullYear().toString().slice(-2);
  if (data) {
    const yr = data.split('-')[0];
    if (yr) yy = yr.slice(-2);
  }

  const letterIndex = Math.floor(nr / 100);
  const letter      = String.fromCharCode(65 + Math.min(letterIndex, 25));
  const last2       = String(nr % 100).padStart(2, '0');

  return `BF${yy}${letter}${last2}`;
}

function updateProgressivo() {
  const editCb = el('progressivo-edit');
  if (editCb && editCb.checked) return; /* manuale: non sovrascrivere */
  const field = el('progressivo-invio');
  if (field) {
    field.value = computeProgressivo();
  }
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
  row.innerHTML = `
    <td class="td-nr nr-cell">${activeLines.size}</td>
    <td class="td-desc">
      <input type="text" id="desc-${id}" placeholder="Descrizione del bene o servizio..." oninput="recalc()" required>
    </td>
    <td class="td-um">
      <input type="text" id="um-${id}" placeholder="pz">
    </td>
    <td class="td-qty">
      <input type="number" id="qty-${id}" value="1" step="any" min="0" oninput="recalcLine(${id})" required>
    </td>
    <td class="td-price">
      <input type="number" id="price-${id}" value="0.00" step="0.01" min="0" oninput="recalcLine(${id})" required>
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
      <select id="natura-${id}" style="display:none">
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
    <td class="td-tot td-calc" id="imponibile-${id}">0,00</td>
    <td class="td-del">
      <button type="button" class="btn-danger-outline" onclick="removeLine(${id})" title="Rimuovi riga">✕</button>
    </td>
  `;
  tbody.appendChild(row);
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
  recalc();
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
  return map;
}

function recalc() {
  const ivaMap = buildIvaMap();
  let totImponibile = 0, totIVA = 0;
  Object.values(ivaMap).forEach(v => { totImponibile += v.imponibile; totIVA += v.imposta; });

  const hasBolloSi   = el('bollo-si')?.checked;
  const hasRivalsaSi = el('rivalsa-si')?.checked;
  const bolloImporto = hasBolloSi ? parseNum(el('importo-bollo')?.value) : 0;
  const bolloInTotale = hasBolloSi && !hasRivalsaSi ? bolloImporto : 0;
  const totFattura    = totImponibile + totIVA + bolloInTotale;

  setCalc('tot-imponibile',       totImponibile);
  setCalc('tot-iva',              totIVA);
  setCalc('tot-fattura',          totFattura);
  setCalc('totale-pagare-amount', totFattura);

  updateRiepilogoIVA(ivaMap);
  syncPagamentoImporto(totFattura);
  checkAutoBollo();
}

function setCalc(id, value) {
  const elem = el(id);
  if (elem) elem.textContent = fmtIt(value) + ' €';
}

function syncPagamentoImporto(total) {
  const impEl = el('pagamento-importo');
  if (impEl && !impEl.dataset.manuallyEdited) {
    impEl.value = fmt(total);
  }
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
  const amount = parseNum(el('importo-bollo')?.value) || 2.00;
  row.innerHTML = buildBolloRivalsaRowHTML(amount);
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
  try {
    const xmlStr  = buildXML();
    const piva    = val('cedente-piva').replace(/\s/g,'');
    const prog    = (val('progressivo-invio') || computeProgressivo()).toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,10);
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
  const progressivo = (val('progressivo-invio') || computeProgressivo()).toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,10) || 'BF00A00';

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
  const hasRivalsaSi = el('rivalsa-si')?.checked;
  const bolloImporto = hasBolloSi ? parseNum(el('importo-bollo')?.value) : 0;
  const bolloInTotale = hasBolloSi && !hasRivalsaSi ? bolloImporto : 0;
  const totFattura    = totImponibile + totIVA + bolloInTotale;

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
  if (hasBolloSi) {
    xml += `        <DatiBollo>\n`;
    xml += `          <BolloVirtuale>SI</BolloVirtuale>\n`;
    if (bolloImporto > 0) xml += `          <ImportoBollo>${fmt(bolloImporto)}</ImportoBollo>\n`;
    xml += `        </DatiBollo>\n`;
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
   Fonte: Bollo_Fattura_Elettronica_Guida_Tecnica
   Attiva automaticamente il bollo virtuale quando le righe
   in fattura soddisfano i criteri di obbligatorietà.
   Nature che richiedono bollo (se IVA=0 e importo > €77,47):
     N1, N2.1, N2.2, N3.5, N3.6, N4, N6.x (reverse charge senza IVA)
   Nature escluse: N3.1, N3.2, N3.3, N3.4, N5, N7
   Non si considera: Sez.5 (NB1/NB2/NB3) e Sez.6 (elenchi trimestrali)
───────────────────────────────────────────────────────────── */
const NATURE_BOLLO_OBBLIGATORIO = ['N1', 'N2.1', 'N2.2', 'N3.5', 'N3.6', 'N4'];
const SOGLIA_BOLLO = 77.47;

function deveApplicareBollo(natura, importoNetto, aliquotaIva) {
  if (importoNetto <= SOGLIA_BOLLO) return false;
  if (aliquotaIva !== 0) return false;                  /* bollo solo per IVA=0 */
  if (NATURE_BOLLO_OBBLIGATORIO.includes(natura)) return true;
  if (natura && natura.startsWith('N6')) return true;   /* reverse charge senza IVA */
  return false;
}

function checkAutoBollo() {
  /* Se l'utente ha esplicitamente disattivato il bollo, rispettiamo la scelta */
  if (bolloManuallyDisabled) return;
  /* Se già attivo non fare nulla */
  if (el('bollo-si')?.checked) return;

  let bolloNecessario = false;

  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;
    const id       = tr.id.replace('line-', '');
    const qty      = parseNum(el(`qty-${id}`)?.value);
    const price    = parseNum(el(`price-${id}`)?.value);
    const disc     = parseNum(el(`disc-${id}`)?.value);
    const iva      = parseFloat(el(`iva-${id}`)?.value || 22);
    const natura   = el(`natura-${id}`)?.value || '';
    const importo  = qty * price * (1 - disc / 100);

    if (deveApplicareBollo(natura, importo, iva)) {
      bolloNecessario = true;
    }
  });

  if (bolloNecessario) {
    const si  = el('bollo-si');
    const no  = el('bollo-no');
    const det = el('bollo-dettaglio');
    if (!si || !no) return;
    si.checked = true;
    no.checked = false;
    si.closest('.checkbox-label')?.classList.add('checked');
    no.closest('.checkbox-label')?.classList.remove('checked');
    if (det) det.style.display = 'block';
    toast('Bollo virtuale attivato automaticamente: operazione soggetta a bollo (importo > €77,47). Puoi disattivarlo manualmente se non applicabile.', 'warning', 6000);
  }
}


function importXML() {
  toast('La funzione di importazione XML sarà disponibile in una versione futura di BrioFE.', 'warning', 5000);
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

  /* Pagamento importo: flag se modificato manualmente */
  const impEl = el('pagamento-importo');
  if (impEl) impEl.addEventListener('input', () => { impEl.dataset.manuallyEdited = '1'; });

  /* Nav attivo iniziale */
  updateActiveNav();

  console.log('%cBrioFE v0.02 alpha — Fatturazione Elettronica', 'color:#009B8A;font-size:14px;font-weight:bold;');
});
