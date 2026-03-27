# Changelog

Tutte le modifiche significative al progetto BrioFE saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e il progetto segue il [Versionamento Semantico](https://semver.org/lang/it/).

---

## [0.01-alpha] - 2025-01-01

### 🎉 Prima versione alpha pubblica

#### Aggiunto
- Generazione fattura elettronica XML **FPR12 v1.2.3** (fatture verso privati e PA)
- Sezione **Dati Cedente / Prestatore** con:
  - Denominazione / Ragione Sociale
  - Partita IVA (11 cifre)
  - Codice Fiscale (opzionale)
  - Tutti i regimi fiscali (RF01–RF20)
  - Sede legale (indirizzo, CAP, comune, provincia)
  - Codice SDI Destinatario e/o PEC
  - Contatti opzionali (tel, email)
- Sezione **Dati Cliente / Cessionario** con:
  - Denominazione o Nome+Cognome (persona fisica)
  - Partita IVA e/o Codice Fiscale
  - Sede / Domicilio fiscale
  - Supporto clienti esteri (selezione nazione)
- Sezione **Intestazione Fattura**:
  - Numero fattura (libero)
  - Data fattura (con default odierna)
  - Tipi documento: TD01, TD04, TD05, TD24, TD25, TD26, TD27
  - Esigibilità IVA: Immediata (I), Differita (D), Scissione pagamenti (S)
  - Campo causale (con supporto testo > 200 caratteri, suddiviso automaticamente)
- Tabella **Righe Fattura** con:
  - Aggiunta/rimozione dinamica di righe
  - Descrizione, Unità di Misura, Quantità, Prezzo Unitario
  - Sconto percentuale per riga
  - Aliquote IVA: 22%, 10%, 5%, 4%, 0%
  - Campo Natura (per IVA 0%): N1, N2.1, N2.2, N3.1–N3.6, N4, N5, N6.1–N6.9, N7
  - Calcolo automatico imponibile per riga
- **Riepilogo IVA** automatico per aliquota/natura
- **Totali** calcolati automaticamente (imponibile, IVA, fattura)
- **Bollo Virtuale** (SI/NO con importo, default €2,00)
- **Rivalsa IVA** (SI/NO)
- Sezione **Pagamento** con:
  - Condizioni pagamento (TP01, TP02, TP03)
  - Modalità pagamento (MP01–MP23, selezione)
  - Data scadenza
  - Importo (auto-sync con totale fattura)
  - IBAN con validazione base
  - BIC/SWIFT
- **Generazione XML** con download diretto (`IT[PIVA]_[progressivo].xml`)
- **Validazione form** con messaggi toast dettagliati
- Design responsive con palette colori BrioFE (teal + navy)
- Pagina di presentazione del progetto (`presentation.html`)
- Nessun salvataggio di dati in locale o remoto (privacy by design)

#### Non ancora implementato (roadmap)
- Importazione XML esistente (pulsante presente ma disabilitato)
- Gestione ritenuta d'acconto e professionisti
- Fattura semplificata (VFSM10)
- Fattura verso PA (FPA12)
- Gestione cassa previdenziale (es. TC22 INPS)
- Righe di sconto a livello documento
- Allegati (base64)
- Modalità multi-fattura / lotto
- Anteprima PDF
- Salvataggio template cedente

---

## Prossime versioni previste

### [0.02-alpha] — Importazione XML
- Lettura di fatture XML esistenti per modifica/copia

### [0.03-alpha] — Fattura Professionisti
- Gestione ritenuta d'acconto (RT01, RT02)
- Cassa previdenziale (INPS gestione separata, etc.)

### [0.10-beta] — Feature complete
- Fattura PA (FPA12)
- Fattura semplificata (VFSM10)
- Anteprima HTML/PDF
- Salvataggio configurazione cedente in localStorage

### [1.0.0] — Prima versione stabile
- Test completi con validatore SDI
- Documentazione completa
- Multi-lingua
