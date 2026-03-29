# Changelog

Tutte le modifiche significative al progetto BrioFE sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).

---

## [0.03-alpha] - 2026-03-28

### Aggiunto
- **Layout Riepilogo IVA + Totali affiancati**: le due sezioni sono ora presentate
  side-by-side (50% ciascuna) per una visualizzazione più compatta e leggibile.
- **Avviso bollo obbligatorio disattivato**: quando il bollo virtuale è obbligatorio
  (importo > €77,47, IVA=0%, Natura in N1/N2.1/N2.2/N3.5/N3.6/N4/N6.x) ma l'utente
  ha selezionato "No" manualmente, appare un riquadro di avviso giallo nella sezione
  Bollo Virtuale. L'avviso scompare non appena si riattiva il bollo o le condizioni
  di obbligatorietà non sono più soddisfatte.
- **Pulsante "Importa cedente/cliente da XML"**: importa selettivamente i dati del
  cedente e/o del cliente (incluso Codice SDI / PEC) da una fattura FPR12 esistente.
  Un modale permette di scegliere cosa importare. Le righe fattura e i dati di
  pagamento non vengono modificati.
- **Importazione XML completa**: il pulsante "Importa XML" ora carica tutti i campi
  supportati da una fattura FPR12 esistente (cedente, cliente, SDI/PEC, intestazione,
  righe, bollo, pagamento). Un avviso di sovrascrittura appare prima di procedere.
  I campi non supportati (DatiRitenuta, DatiCassaPrevidenziale, ecc.) sono ignorati
  con notifica. La riga rivalsa bollo generata da BrioFE viene riconosciuta e
  ricreata automaticamente attivando il checkbox Rivalsa.

### Modificato
- **Pulsante "Importa XML"**: non più disabilitato (stub), ora funzionante con
  apertura file picker e parsing DOMParser nativo.
- **Sezione Bollo Virtuale**: spostata fuori dal `bottom-grid`, ora occupa tutta la
  larghezza della pagina sotto il riquadro Riepilogo IVA + Totali.

---

## [0.02-alpha] - 2026-03-28

### Aggiunto
- **Menu di navigazione rapida** laterale (sidebar) con accesso diretto alle 8 sezioni del form.
  Aperto/chiuso tramite pulsante hamburger. La pagina resta completamente interattiva
  con il menu aperto (nessun overlay che blocca o oscura il contenuto).
  La voce attiva si aggiorna automaticamente durante lo scroll. Chiuso per default all'avvio.
- **Progressivo Invio automatico** nella sezione Trasmissione SDI.
  Formato proprietario BrioFE a 7 caratteri: `BF` + anno 2 cifre + lettera
  (A=0–99, B=100–199, C=200–299 …) + ultime 2 cifre del numero fattura.
  Esempio: fattura n. 121 del 2026 → `BF26B21`.
  Campo calcolato, modificabile manualmente tramite checkbox di conferma.
- **Auto-attivazione Bollo Virtuale**: quando le righe fattura soddisfano i criteri
  di obbligatorietà (importo > €77,47, IVA=0%, Natura in N1/N2.1/N2.2/N3.5/N3.6/N4/N6.x)
  il bollo viene attivato automaticamente con notifica toast. Se l'utente disattiva
  manualmente il bollo, la scelta viene rispettata e non viene ri-attivato.
  Fonte normativa: Art. 6 D.M. 17/06/2014; DPR 642/1972 art. 15.
- **Pulsante "Genera PDF"** disabilitato accanto a "Genera XML" (implementazione futura).
- **Link "Visualizzatore"** nell'header → `visualizzatore.html`.

### Modificato
- **Sezione Trasmissione SDI**: rimossa la descrizione del formato progressivo dall'info-box.
  Mantenuto solo il testo di aiuto per il Codice SDI (come da v0.01).
  Il progressivo ha ora solo il suggerimento "Generato automaticamente".
- **Numero fattura**: valore e placeholder di default aggiornati a `1/[anno corrente]`
  (es. `1/2026`).
- **Causale**: placeholder aggiornato a "Descrizione sintetica dell'operazione
  (es: Vendita merce/Noleggio/Prestazione di servizi)".
- **Pulsanti Genera**: sempre allineati a destra della barra, con info-text a sinistra
  e `margin-left: auto` sui pulsanti.
- **Overlay navigazione**: rimosso il fondo grigio/scuro. Il menu sidebar galleggia
  sopra il contenuto senza bloccare o oscurare la pagina.
- `presentation.html`: aggiornata a v0.02, aggiunte card feature "Bollo Virtuale automatico"
  e "Progressivo Invio BrioFE", aggiunta riga nella tabella Specifiche Tecniche,
  aggiornata roadmap.

### Corretto (rispetto alla v0.02 iniziale)
- Nav chiuso esplicitamente all'avvio (`navOpen = false` + rimozione classe `open`)
  per evitare flash del menu su alcuni browser.

---

## [0.01-alpha] - 2026-01-01

### Prima versione alpha pubblica

#### Aggiunto
- Generazione fattura elettronica XML **FPR12 v1.2.3**
- Sezione Dati Cedente / Prestatore con tutti i campi SDI (RF01–RF20)
- Sezione Dati Cliente / Cessionario con supporto estero
- Sezione Trasmissione SDI (codice destinatario, PEC, default `0000000`)
- Intestazione Fattura: tipo documento TD01–TD27, data, esigibilità IVA, causale
- Tabella Righe Fattura con aliquote e codici Natura per IVA 0%
- Riepilogo IVA automatico per aliquota/natura
- Bollo Virtuale con rivalsa (riga automatica N1)
- Dati Pagamento: modalità MP01–MP23, IBAN, BIC
- Generazione XML + download `IT[PIVA]_[progressivo].xml`
- Validazione form con toast notifications
- Pagina di presentazione (`presentation.html`)
- Privacy by design (nessun dato salvato o trasmesso)
- Licenza GPL-3.0

---

## Roadmap

### [0.03-alpha] — Visualizzatore & Importazione XML
- Visualizzatore fatture elettroniche XML FPR12
- Visualizzatore messaggi SDI (notifiche, ricevute, esiti)
- Importazione di file XML esistenti per modifica/copia

### [0.04-alpha] — Professionisti
- Ritenuta d'acconto (RT01, RT02)
- Cassa previdenziale (INPS gestione separata, etc.)
- Parcella (TD06)

### [0.05-alpha] — Genera PDF
- Anteprima e download PDF della fattura

### [0.10-beta] — Feature complete
- Fattura PA (FPA12) con CIG/CUP
- Salvataggio configurazione cedente in localStorage

### [0.20-beta] — Visualizzatore NSO
- Visualizzatore ordini NSO (XML PEPPOL BIS 3)
- Lettura notifiche e risposte NSO
- Supporto messaggi SDI correlati

### [1.0.0] — Prima versione stabile
- Test con validatore SDI ufficiale
- Documentazione completa
