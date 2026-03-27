/**
 * BrioFE - Fatturazione Elettronica
 * app.js v0.01 alpha
 * 
 * Genera fatture elettroniche in formato XML FPR12 (B2B/privati)
 * secondo le specifiche SDI dell'Agenzia delle Entrate italiana.
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let lineCounter = 0;
const activeLines = new Set();

/* ─────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────────────────────── */

/** Escapes special XML characters */
function escXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/** Parses a number from string (supports both comma and dot decimals) */
function parseNum(s) {
  if (s == null || s === '') return 0;
  return parseFloat(String(s).replace(',', '.')) || 0;
}

/** Formats number with fixed decimal places */
function fmt(n, decimals = 2) {
  return parseFloat(n || 0).toFixed(decimals);
}

/** Formats number in Italian locale (for display) */
function fmtIt(n, decimals = 2) {
  return parseFloat(n || 0).toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/** Gets element value trimmed */
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Gets element, returns null if not found */
function el(id) { return document.getElementById(id); }

/** Shows toast notification */
function toast(msg, type = 'success', duration = 4000) {
  const container = el('toast-container');
  if (!container) return;
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span style="font-size:1.1em;font-weight:700">${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateX(20px)';
    div.style.transition = '.3s ease';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

/* ─────────────────────────────────────────────────────────────
   LINE MANAGEMENT
───────────────────────────────────────────────────────────── */

function addLine() {
  lineCounter++;
  const id = lineCounter;
  activeLines.add(id);

  const tbody = el('linee-body');
  const row = document.createElement('tr');
  row.id = `line-${id}`;
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
      <button type="button" class="btn btn-danger-outline" onclick="removeLine(${id})" title="Rimuovi riga">✕</button>
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
    if (tr.id === BOLLO_ROW_ID) return;   // riga bloccata: non rinumerare
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
  const qty    = parseNum(el(`qty-${id}`)?.value);
  const price  = parseNum(el(`price-${id}`)?.value);
  const disc   = parseNum(el(`disc-${id}`)?.value);

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
  /* key = "aliquota|natura" e.g. "22.00|" or "0.00|N4" */
  const map = {};

  document.querySelectorAll('#linee-body tr').forEach(tr => {
    /* Riga bollo rivalsa: gestita separatamente */
    if (tr.id === BOLLO_ROW_ID) {
      const br = getBolloRivalsaData();
      if (!br) return;
      const key = `${fmt(br.aliquota)}|${br.natura}`;
      if (!map[key]) map[key] = { aliquota: br.aliquota, natura: br.natura, imponibile: 0, imposta: 0 };
      map[key].imponibile += br.imponibile;
      return;
    }

    const id = tr.id.replace('line-', '');
    const qty    = parseNum(el(`qty-${id}`)?.value);
    const price  = parseNum(el(`price-${id}`)?.value);
    const disc   = parseNum(el(`disc-${id}`)?.value);
    const iva    = parseFloat(el(`iva-${id}`)?.value || 22);
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

  let totImponibile = 0;
  let totIVA        = 0;

  Object.values(ivaMap).forEach(v => {
    totImponibile += v.imponibile;
    totIVA        += v.imposta;
  });

  const hasBolloSi      = el('bollo-si')?.checked;
  const hasRivalsaSi    = el('rivalsa-si')?.checked;
  const bolloImporto    = hasBolloSi ? parseNum(el('importo-bollo')?.value) : 0;

  /*
   * Il totale fattura include:
   * - Imponibile (somma righe normali + riga rivalsa bollo se presente)
   * - IVA
   * - Bollo virtuale (solo se bollo=SI e rivalsa=NO, cioè il bollo è a carico del cedente
   *   ma deve risultare nel totale documento per il DatiBollo XML)
   *   Se rivalsa=SI, il bollo è già contato come riga imponibile.
   */
  const bolloInTotale = hasBolloSi && !hasRivalsaSi ? bolloImporto : 0;
  const totFattura    = totImponibile + totIVA + bolloInTotale;

  /* Aggiorna display totali */
  setCalc('tot-imponibile',       totImponibile);
  setCalc('tot-iva',              totIVA);
  setCalc('tot-fattura',          totFattura);
  setCalc('totale-pagare-amount', totFattura);

  /* Aggiorna riepilogo IVA */
  updateRiepilogoIVA(ivaMap);
}

function setCalc(id, value) {
  const elem = el(id);
  if (elem) elem.textContent = fmtIt(value) + ' €';
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
    tr.innerHTML = `
      <td>${fmtIt(v.imponibile)} €</td>
      <td>${fmt(v.aliquota)}%${v.natura ? ' (' + v.natura + ')' : ''}</td>
      <td>${fmtIt(v.imposta)} €</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────────────────────────────
   CHECKBOX HANDLERS
───────────────────────────────────────────────────────────── */

function handleBolloChange() {
  const si = el('bollo-si');
  const no = el('bollo-no');
  const dettaglio = el('bollo-dettaglio');

  if (si.checked) {
    si.closest('.checkbox-label')?.classList.add('checked');
    no.closest('.checkbox-label')?.classList.remove('checked');
    if (dettaglio) dettaglio.style.display = 'block';
  } else {
    no.closest('.checkbox-label')?.classList.add('checked');
    si.closest('.checkbox-label')?.classList.remove('checked');
    if (dettaglio) dettaglio.style.display = 'none';
    /* Rimuovi riga rivalsa bollo se bollo disattivato */
    removeBolloRivalsaRow();
    /* Reset rivalsa checkbox a NO */
    const rivSi = el('rivalsa-si');
    const rivNo = el('rivalsa-no');
    if (rivSi && rivNo) {
      rivSi.checked = false;
      rivNo.checked = true;
      rivSi.closest('.checkbox-label')?.classList.remove('checked');
      rivNo.closest('.checkbox-label')?.classList.add('checked');
    }
  }
  recalc();
}

function handleRivalsaBolloChange() {
  const si = el('rivalsa-si');
  const no = el('rivalsa-no');

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

/* ─────────────────────────────────────────────────────────────
   BOLLO RIVALSA ROW (riga bloccata)
───────────────────────────────────────────────────────────── */

const BOLLO_ROW_ID = 'bollo-rivalsa-row';

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
  const lineIndex = document.querySelectorAll('#linee-body tr').length + 1;
  return `
    <td class="td-nr nr-cell">🔒</td>
    <td class="td-desc">
      <span class="bollo-row-badge">⚑ AUTO</span>
      <span style="font-size:.82rem;color:#5A3A00;font-weight:600;margin-left:6px">
        Rivalsa Bollo Virtuale – Escluso art.15 D.P.R. 642/1972
      </span>
    </td>
    <td class="td-um"><span class="locked-cell">—</span></td>
    <td class="td-qty"><span class="locked-cell">1</span></td>
    <td class="td-price"><span class="locked-cell">${fmt(amount)}</span></td>
    <td class="td-disc"><span class="locked-cell">—</span></td>
    <td class="td-iva"><span class="locked-cell">0%</span></td>
    <td class="td-natura"><span class="locked-cell" style="font-size:.75rem">N1 – Escluse art.15</span></td>
    <td class="td-tot td-calc">${fmtIt(amount)}</td>
    <td class="td-del" title="Riga generata automaticamente dal bollo virtuale" style="color:#FDDBA0;text-align:center;font-size:1rem">🔒</td>
  `;
}

/* Incapsula i dati della riga bollo-rivalsa per le funzioni di calcolo e XML */
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
    if (!elem.value.trim()) {
      errors.push(`Il campo "${label}" è obbligatorio.`);
      elem.classList.add('is-invalid');
    } else {
      elem.classList.remove('is-invalid');
    }
  });

  /* Almeno una riga */
  if (activeLines.size === 0) {
    errors.push('Inserire almeno una riga nella fattura.');
  }

  /* P.IVA deve essere 11 cifre */
  const piva = val('cedente-piva').replace(/\s/g, '');
  if (piva && !/^\d{11}$/.test(piva)) {
    errors.push('La P.IVA del Cedente deve essere di 11 cifre numeriche.');
  }

  /* IBAN (se presente) */
  const iban = val('pagamento-iban').replace(/\s/g, '');
  if (iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/i.test(iban)) {
    errors.push('L\'IBAN inserito non sembra valido.');
  }

  /* Controllo righe: descrizione obbligatoria */
  let rowIndex = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    if (tr.id === BOLLO_ROW_ID) return;   // riga auto-generata: salta validazione
    rowIndex++;
    const id   = tr.id.replace('line-', '');
    const desc = el(`desc-${id}`)?.value?.trim();
    if (!desc) errors.push(`Riga ${rowIndex}: la descrizione è obbligatoria.`);
    const iva = parseFloat(el(`iva-${id}`)?.value || 22);
    if (iva === 0) {
      const natura = el(`natura-${id}`)?.value;
      if (!natura) errors.push(`Riga ${rowIndex}: selezionare la Natura per IVA 0%.`);
    }
  });

  if (errors.length > 0) {
    errors.forEach(msg => toast(msg, 'error', 6000));
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   XML GENERATION
───────────────────────────────────────────────────────────── */

function generateXML() {
  if (!validateForm()) return;

  try {
    const xmlStr  = buildXML();
    const piva    = val('cedente-piva').replace(/\s/g, '');
    const numero  = val('fattura-numero').replace(/[^A-Za-z0-9_\-]/g, '_');
    const prog    = numero.substring(0, 5).padStart(5, '0');
    const filename = `IT${piva}_${prog}.xml`;

    downloadXML(xmlStr, filename);
    toast(`Fattura XML generata: ${filename}`, 'success', 5000);
  } catch (err) {
    console.error(err);
    toast('Errore durante la generazione XML: ' + err.message, 'error', 8000);
  }
}

function downloadXML(xmlStr, filename) {
  const blob = new Blob([xmlStr], { type: 'application/xml;charset=UTF-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildXML() {
  /* ── Raccolta dati ─────────────────────────────────────── */
  const pivaIt      = val('cedente-piva').replace(/\s/g, '');
  const cfCedente   = val('cedente-cf').replace(/\s/g, '');
  const denomCed    = val('cedente-denominazione');
  const regimeFisc  = val('cedente-regime');
  const indCed      = val('cedente-indirizzo');
  const capCed      = val('cedente-cap');
  const comCed      = val('cedente-comune');
  const provCed     = val('cedente-provincia');
  const telCed      = val('cedente-tel');
  const emailCed    = val('cedente-email');

  const sdiCode     = (val('cedente-sdi').toUpperCase() || '0000000').padEnd(7, '0').substring(0, 7) || '0000000';
  const pecDest     = val('cedente-pec');

  /* Progressivo invio: nr. fattura troncato a 10 chars alfanum */
  const nrFatt      = val('fattura-numero');
  const progressivo = nrFatt.replace(/[^A-Za-z0-9]/g, '').substring(0, 10) || '00001';

  /* Cliente */
  const pivaCliente = val('cliente-piva').replace(/\s/g, '');
  const cfCliente   = val('cliente-cf').replace(/\s/g, '');
  const denomCli    = val('cliente-denominazione');
  const nomeCli     = val('cliente-nome');
  const cognomeCli  = val('cliente-cognome');
  const indCli      = val('cliente-indirizzo');
  const capCli      = val('cliente-cap');
  const comCli      = val('cliente-comune');
  const provCli     = val('cliente-provincia');
  const nazCli      = val('cliente-nazione') || 'IT';

  /* Fattura */
  const tipoDoc     = val('fattura-tipo');
  const dataFatt    = val('fattura-data');  // YYYY-MM-DD
  const causale     = val('fattura-causale');
  const esigIVA     = val('fattura-esigibilita') || 'I';

  /* IVA map e totali */
  const ivaMap      = buildIvaMap();
  let totImponibile = 0;
  let totIVA        = 0;
  Object.values(ivaMap).forEach(v => {
    totImponibile += v.imponibile;
    totIVA        += v.imposta;
  });

  const hasBolloSi   = el('bollo-si')?.checked;
  const hasRivalsaSi = el('rivalsa-si')?.checked;
  const bolloImporto = hasBolloSi ? parseNum(el('importo-bollo')?.value) : 0;
  /* Il bollo incide sul totale direttamente solo se NON c'è rivalsa
     (con rivalsa è già compreso come riga imponibile) */
  const bolloInTotale = hasBolloSi && !hasRivalsaSi ? bolloImporto : 0;
  const totFattura    = totImponibile + totIVA + bolloInTotale;

  /* Pagamento */
  const condPag     = val('pagamento-condizioni') || 'TP02';
  const modalPag    = val('pagamento-modalita');
  const dataSc      = val('pagamento-scadenza');
  const impPag      = val('pagamento-importo') || fmt(totFattura);
  const iban        = val('pagamento-iban').replace(/\s/g, '');
  const bic         = val('pagamento-bic').replace(/\s/g, '');

  /* ── Costruzione XML ───────────────────────────────────── */
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<p:FatturaElettronica versione="FPR12" SistemaEmittente="BrioFE"\n`;
  xml += `  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"\n`;
  xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 https://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">\n`;

  /* ── HEADER ─────────────────────────────────────────────── */
  xml += `  <FatturaElettronicaHeader>\n`;

  /* DatiTrasmissione */
  xml += `    <DatiTrasmissione>\n`;
  xml += `      <IdTrasmittente>\n`;
  xml += `        <IdPaese>IT</IdPaese>\n`;
  xml += `        <IdCodice>${escXml(pivaIt)}</IdCodice>\n`;
  xml += `      </IdTrasmittente>\n`;
  xml += `      <ProgressivoInvio>${escXml(progressivo)}</ProgressivoInvio>\n`;
  xml += `      <FormatoTrasmissione>FPR12</FormatoTrasmissione>\n`;
  xml += `      <CodiceDestinatario>${escXml(sdiCode)}</CodiceDestinatario>\n`;
  if (pecDest) {
    xml += `      <PECDestinatario>${escXml(pecDest)}</PECDestinatario>\n`;
  }
  xml += `    </DatiTrasmissione>\n`;

  /* CedentePrestatore */
  xml += `    <CedentePrestatore>\n`;
  xml += `      <DatiAnagrafici>\n`;
  xml += `        <IdFiscaleIVA>\n`;
  xml += `          <IdPaese>IT</IdPaese>\n`;
  xml += `          <IdCodice>${escXml(pivaIt)}</IdCodice>\n`;
  xml += `        </IdFiscaleIVA>\n`;
  if (cfCedente) {
    xml += `        <CodiceFiscale>${escXml(cfCedente)}</CodiceFiscale>\n`;
  }
  xml += `        <Anagrafica>\n`;
  xml += `          <Denominazione>${escXml(denomCed)}</Denominazione>\n`;
  xml += `        </Anagrafica>\n`;
  xml += `        <RegimeFiscale>${escXml(regimeFisc)}</RegimeFiscale>\n`;
  xml += `      </DatiAnagrafici>\n`;
  xml += `      <Sede>\n`;
  xml += `        <Indirizzo>${escXml(indCed)}</Indirizzo>\n`;
  xml += `        <CAP>${escXml(capCed)}</CAP>\n`;
  xml += `        <Comune>${escXml(comCed)}</Comune>\n`;
  if (provCed) {
    xml += `        <Provincia>${escXml(provCed.toUpperCase().substring(0,2))}</Provincia>\n`;
  }
  xml += `        <Nazione>IT</Nazione>\n`;
  xml += `      </Sede>\n`;
  if (telCed || emailCed) {
    xml += `      <Contatti>\n`;
    if (telCed)   xml += `        <Telefono>${escXml(telCed)}</Telefono>\n`;
    if (emailCed) xml += `        <Email>${escXml(emailCed)}</Email>\n`;
    xml += `      </Contatti>\n`;
  }
  xml += `    </CedentePrestatore>\n`;

  /* CessionarioCommittente */
  xml += `    <CessionarioCommittente>\n`;
  xml += `      <DatiAnagrafici>\n`;
  if (pivaCliente) {
    xml += `        <IdFiscaleIVA>\n`;
    xml += `          <IdPaese>${escXml(nazCli)}</IdPaese>\n`;
    xml += `          <IdCodice>${escXml(pivaCliente)}</IdCodice>\n`;
    xml += `        </IdFiscaleIVA>\n`;
  }
  if (cfCliente) {
    xml += `        <CodiceFiscale>${escXml(cfCliente)}</CodiceFiscale>\n`;
  }
  xml += `        <Anagrafica>\n`;
  if (denomCli) {
    xml += `          <Denominazione>${escXml(denomCli)}</Denominazione>\n`;
  } else if (nomeCli || cognomeCli) {
    xml += `          <Nome>${escXml(nomeCli)}</Nome>\n`;
    xml += `          <Cognome>${escXml(cognomeCli)}</Cognome>\n`;
  }
  xml += `        </Anagrafica>\n`;
  xml += `      </DatiAnagrafici>\n`;
  xml += `      <Sede>\n`;
  xml += `        <Indirizzo>${escXml(indCli)}</Indirizzo>\n`;
  xml += `        <CAP>${escXml(capCli)}</CAP>\n`;
  xml += `        <Comune>${escXml(comCli)}</Comune>\n`;
  if (provCli) {
    xml += `        <Provincia>${escXml(provCli.toUpperCase().substring(0,2))}</Provincia>\n`;
  }
  xml += `        <Nazione>${escXml(nazCli)}</Nazione>\n`;
  xml += `      </Sede>\n`;
  xml += `    </CessionarioCommittente>\n`;

  xml += `  </FatturaElettronicaHeader>\n`;

  /* ── BODY ───────────────────────────────────────────────── */
  xml += `  <FatturaElettronicaBody>\n`;

  /* DatiGenerali */
  xml += `    <DatiGenerali>\n`;
  xml += `      <DatiGeneraliDocumento>\n`;
  xml += `        <TipoDocumento>${escXml(tipoDoc)}</TipoDocumento>\n`;
  xml += `        <Divisa>EUR</Divisa>\n`;
  xml += `        <Data>${escXml(dataFatt)}</Data>\n`;
  xml += `        <Numero>${escXml(nrFatt)}</Numero>\n`;

  if (hasBolloSi) {
    xml += `        <DatiBollo>\n`;
    xml += `          <BolloVirtuale>SI</BolloVirtuale>\n`;
    if (bolloImporto > 0) {
      xml += `          <ImportoBollo>${fmt(bolloImporto)}</ImportoBollo>\n`;
    }
    xml += `        </DatiBollo>\n`;
  }

  xml += `        <ImportoTotaleDocumento>${fmt(totFattura)}</ImportoTotaleDocumento>\n`;

  if (causale) {
    /* Causale max 200 chars, può essere ripetuta */
    const causaleParts = causale.match(/.{1,200}/g) || [];
    causaleParts.forEach(part => {
      xml += `        <Causale>${escXml(part)}</Causale>\n`;
    });
  }

  xml += `      </DatiGeneraliDocumento>\n`;
  xml += `    </DatiGenerali>\n`;

  /* DatiBeniServizi */
  xml += `    <DatiBeniServizi>\n`;

  let lineNum = 0;
  document.querySelectorAll('#linee-body tr').forEach(tr => {
    lineNum++;

    /* ── Riga Rivalsa Bollo (auto-generata, bloccata) ── */
    if (tr.id === BOLLO_ROW_ID) {
      const br = getBolloRivalsaData();
      if (!br) return;
      xml += `      <DettaglioLinee>\n`;
      xml += `        <NumeroLinea>${lineNum}</NumeroLinea>\n`;
      xml += `        <Descrizione>Rivalsa Bollo Virtuale - Escluso art. 15 D.P.R. 642/1972</Descrizione>\n`;
      xml += `        <Quantita>1.00000000</Quantita>\n`;
      xml += `        <PrezzoUnitario>${fmt(br.imponibile, 8)}</PrezzoUnitario>\n`;
      xml += `        <PrezzoTotale>${fmt(br.imponibile, 8)}</PrezzoTotale>\n`;
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

    const prezzoScontato = price * (1 - disc / 100);
    const imponibile     = qty * prezzoScontato;

    xml += `      <DettaglioLinee>\n`;
    xml += `        <NumeroLinea>${lineNum}</NumeroLinea>\n`;
    xml += `        <Descrizione>${escXml(desc)}</Descrizione>\n`;
    if (qty !== 1 || um) {
      xml += `        <Quantita>${fmt(qty, 8).replace(/\.?0+$/, '') || '1'}</Quantita>\n`;
    }
    if (um) {
      xml += `        <UnitaMisura>${escXml(um)}</UnitaMisura>\n`;
    }
    xml += `        <PrezzoUnitario>${fmt(price, 8)}</PrezzoUnitario>\n`;
    if (disc > 0) {
      xml += `        <ScontoMaggiorazione>\n`;
      xml += `          <Tipo>SC</Tipo>\n`;
      xml += `          <Percentuale>${fmt(disc, 2)}</Percentuale>\n`;
      xml += `        </ScontoMaggiorazione>\n`;
    }
    xml += `        <PrezzoTotale>${fmt(imponibile, 8)}</PrezzoTotale>\n`;
    xml += `        <AliquotaIVA>${fmt(iva)}</AliquotaIVA>\n`;
    if (natura) {
      xml += `        <Natura>${escXml(natura)}</Natura>\n`;
    }
    xml += `      </DettaglioLinee>\n`;
  });

  /* DatiRiepilogo (uno per ogni combinazione aliquota+natura) */
  Object.values(ivaMap).forEach(v => {
    xml += `      <DatiRiepilogo>\n`;
    xml += `        <AliquotaIVA>${fmt(v.aliquota)}</AliquotaIVA>\n`;
    if (v.natura) {
      xml += `        <Natura>${escXml(v.natura)}</Natura>\n`;
    }
    xml += `        <ImponibileImporto>${fmt(v.imponibile)}</ImponibileImporto>\n`;
    xml += `        <Imposta>${fmt(v.imposta)}</Imposta>\n`;
    if (v.aliquota > 0) {
      xml += `        <EsigibilitaIVA>${escXml(esigIVA)}</EsigibilitaIVA>\n`;
    }
    xml += `      </DatiRiepilogo>\n`;
  });

  xml += `    </DatiBeniServizi>\n`;

  /* DatiPagamento */
  xml += `    <DatiPagamento>\n`;
  xml += `      <CondizioniPagamento>${escXml(condPag)}</CondizioniPagamento>\n`;
  xml += `      <DettaglioPagamento>\n`;
  xml += `        <ModalitaPagamento>${escXml(modalPag)}</ModalitaPagamento>\n`;
  if (dataSc) {
    xml += `        <DataScadenzaPagamento>${escXml(dataSc)}</DataScadenzaPagamento>\n`;
  }
  xml += `        <ImportoPagamento>${fmt(parseNum(impPag))}</ImportoPagamento>\n`;
  if (iban) {
    xml += `        <IBAN>${escXml(iban)}</IBAN>\n`;
  }
  if (bic) {
    xml += `        <BIC>${escXml(bic)}</BIC>\n`;
  }
  xml += `      </DettaglioPagamento>\n`;
  xml += `    </DatiPagamento>\n`;

  xml += `  </FatturaElettronicaBody>\n`;
  xml += `</p:FatturaElettronica>\n`;

  return xml;
}

/* ─────────────────────────────────────────────────────────────
   IMPORT XML (placeholder per versioni future)
───────────────────────────────────────────────────────────── */

function importXML() {
  toast('La funzione di importazione XML sarà disponibile in una versione futura di BrioFE.', 'warning', 5000);
}

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  /* Imposta data odierna come default */
  const today = new Date().toISOString().split('T')[0];
  const dataEl = el('fattura-data');
  if (dataEl && !dataEl.value) dataEl.value = today;

  /* Aggiorna importo pagamento quando cambia il totale */
  const observer = new MutationObserver(() => {
    const totAm = el('totale-pagare-amount');
    const impEl = el('pagamento-importo');
    if (totAm && impEl && !impEl.dataset.manuallyEdited) {
      const raw = totAm.textContent.replace(/[^\d,.]/g, '').replace(',', '.');
      impEl.value = parseFloat(raw).toFixed(2);
    }
  });
  const totEl = el('totale-pagare-amount');
  if (totEl) observer.observe(totEl, { childList: true, characterData: true, subtree: true });

  /* Flag se importo pagamento viene modificato manualmente */
  const impEl = el('pagamento-importo');
  if (impEl) {
    impEl.addEventListener('input', () => { impEl.dataset.manuallyEdited = '1'; });
  }

  /* Aggiunge prima riga automaticamente */
  addLine();

  /* Rivalsa bollo: default NO (il bollo-dettaglio è hidden, rivalsa irrilevante) */
  const rivNo = el('rivalsa-no');
  if (rivNo) {
    rivNo.checked = true;
    rivNo.closest('.checkbox-label')?.classList.add('checked');
  }

  console.log('%cBrioFE v0.01 alpha — Fatturazione Elettronica', 
    'color:#009B8A;font-size:14px;font-weight:bold;');
});
