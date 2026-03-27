# BrioFE — Programma di Fatturazione Elettronica

![BrioFE Logo](img/logobriofe1.png)

> Genera fatture elettroniche XML conformi al formato SDI FPR12 v1.2.3 dell'Agenzia delle Entrate italiana — direttamente nel browser, senza installazioni, senza server, senza memorizzazione di dati.

[![Versione](https://img.shields.io/badge/versione-0.01--alpha-orange)](CHANGELOG.md)
[![Licenza](https://img.shields.io/badge/licenza-GPL--3.0-green)](LICENSE)
[![Standard](https://img.shields.io/badge/standard-FPR12%20v1.2.3-blue)](https://www.fatturapa.gov.it)
[![HTML5](https://img.shields.io/badge/HTML5-pure-red)](https://developer.mozilla.org/en-US/docs/Web/HTML)

---

## ✨ Funzionalità (v0.01 alpha)

- 📋 **Compilazione guidata** di tutti i campi della fattura ordinaria
- 🧮 **Calcolo automatico** di imponibili, IVA, totali e riepilogo aliquote
- 📥 **Generazione e download** del file XML `IT[PIVA]_[progressivo].xml`
- ✅ **Validazione** dei campi obbligatori prima della generazione
- 🔐 **Privacy by design**: nessun dato viene salvato o trasmesso
- 📱 **Responsive**: funziona su desktop, tablet e mobile
- 🆓 **Zero dipendenze server**: funziona aprendo direttamente il file HTML

---

## 🚀 Come iniziare

### Utilizzo rapido (senza server)

1. **Scarica o clona** il repository:
   ```bash
   git clone https://github.com/briofe/briofe.git
   ```

2. **Apri** il file `index.html` nel browser:
   - Windows: doppio click su `index.html`
   - Mac/Linux: `open index.html` nel terminale
   - Oppure trascina il file nel browser

3. **Compila** il modulo con i dati del cedente, cliente e righe fattura

4. Clicca su **"Genera XML FPR12"** per scaricare il file XML

### Con server locale (consigliato per sviluppo)

```bash
# Python 3
python -m http.server 8080

# Node.js (con npx)
npx serve .

# PHP
php -S localhost:8080
```

Poi apri `http://localhost:8080` nel browser.

---

## 📁 Struttura del Progetto

```
briofe/
├── index.html              # Applicazione principale
├── presentation.html       # Pagina di presentazione del progetto
├── LICENSE                 # Licenza GPL-3.0
├── README.md               # Questo file
├── CHANGELOG.md            # Storico delle modifiche
├── img/
│   └── logobriofe1.png     # Logo BrioFE
└── asset/
    ├── style.css           # Foglio di stile principale
    └── app.js              # Logica applicativa (generazione XML)
```

---

## 📄 Formato XML generato

BrioFE genera file XML conformi alle specifiche:
- **Formato**: `FPR12` (Fattura verso Privati, B2B e verso PA con formato ordinario)
- **Standard**: Schema XSD `v1.2.3` — `http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2`
- **Nome file**: `IT[PARTITAIVA]_[PROGRESSIVO].xml` (es: `IT12345678901_00001.xml`)
- **Encoding**: UTF-8

### Esempio struttura XML generata

```xml
<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" SistemaEmittente="BrioFE"
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione> ... </DatiTrasmissione>
    <CedentePrestatore> ... </CedentePrestatore>
    <CessionarioCommittente> ... </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali> ... </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee> ... </DettaglioLinee>
      <DatiRiepilogo> ... </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento> ... </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
```

---

## 📋 Tipi documento supportati

| Codice | Descrizione |
|--------|-------------|
| TD01 | Fattura ordinaria |
| TD04 | Nota di credito |
| TD05 | Nota di debito |
| TD24 | Fattura differita (art.21 c.4 lett. a) |
| TD25 | Fattura differita (art.21 c.4 lett. b) |
| TD26 | Cessione beni ammortizzabili |
| TD27 | Fattura autoconsumo/cessione gratuita |

---

## 🔢 Aliquote IVA e Natura

Aliquote supportate: **22%, 10%, 5%, 4%, 0%**

Per IVA 0%, selezionare il codice Natura:

| Codice | Descrizione |
|--------|-------------|
| N1 | Escluse ex art. 15 |
| N2.1 | Non soggette artt. 7–7-septies |
| N2.2 | Non soggette — altri casi |
| N3.1–N3.6 | Non imponibili (vari casi) |
| N4 | Esenti |
| N5 | Regime del margine |
| N6.1–N6.9 | Inversione contabile (reverse charge) |
| N7 | IVA assolta in altro stato UE |

---

## 💳 Modalità di pagamento

Supportate: MP01 (contanti), MP05 (bonifico), MP08 (carta), MP12 (RIBA), MP19–MP21 (SEPA), MP23 (PagoPA) e altre.

---

## ⚠️ Limitazioni versione 0.01-alpha

- ❌ Non supporta fatture di **professionisti** con ritenuta d'acconto
- ❌ Non supporta la **cassa previdenziale** (es. INPS gestione separata)
- ❌ Non supporta la **fattura PA** (FPA12) con CIG/CUP
- ❌ Non supporta la **fattura semplificata** (VFSM10)
- ❌ L'**importazione XML** non è ancora disponibile
- ❌ Non gestisce **allegati** nella fattura

---

## 🗺️ Roadmap

Vedi [CHANGELOG.md](CHANGELOG.md) per i dettagli sulle prossime versioni.

---

## 📜 Licenza

Distribuito sotto licenza **GPL-3.0**. Vedi [LICENSE](LICENSE) per i dettagli.

---

## ⚖️ Disclaimer

BrioFE è un software open source fornito "così com'è". Non costituisce consulenza fiscale o tributaria. Verificare sempre la conformità dei documenti generati con la normativa vigente prima della trasmissione al SDI. Gli autori non sono responsabili per eventuali errori fiscali derivanti dall'utilizzo del software.

---

## 🔗 Link utili

- [Specifiche tecniche FPR12 — Agenzia delle Entrate](https://www.fatturapa.gov.it)
- [Portale Fatturazione Elettronica](https://ivaservizi.agenziaentrate.gov.it/portale/)
- [Schema XSD ufficiale FPR12 v1.2.3](https://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/)
- [Guida alla fatturazione elettronica](https://www.agenziaentrate.gov.it/portale/web/guest/fattura-elettronica)
