# Catalogo inglese con definizioni italiane

`catalog.json` contiene una selezione normalizzata di voci inglesi estratte dal
Wikizionario italiano tramite Kaikki/Wiktextract. Le 56 voci editoriali di
`words.ts` hanno precedenza e non vengono sostituite.

- Fonte: https://kaikki.org/itwiktionary/Inglese/index.html
- Download: https://kaikki.org/itwiktionary/Inglese/kaikki.org-dictionary-Inglese.jsonl
- Autori: collaboratori del Wikizionario italiano; cronologia disponibile nella
  pagina di ciascuna parola su https://it.wiktionary.org/.
- Licenza dei testi: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/.
  I testi derivati mantengono questa licenza; la licenza del codice non cambia.
- Snapshot scaricato il 2 ottobre 2026. Il collegamento di download punta alla
  versione aggiornata del dataset, non a uno snapshot immutabile.

Modifiche applicate: selezione delle voci inglesi in minuscolo, esclusione di forme
flesse e significati marcati obsoleti/rari/offensivi, normalizzazione delle
categorie grammaticali e degli spazi, raggruppamento dei significati per parola,
selezione degli esempi e collegamenti audio. Non vengono inventati livelli CEFR,
esempi, pronunce o traduzioni mancanti. Il catalogo ampio comprende anche termini
specialistici; le parole comuni e le voci con esempi hanno priorità.

Gli audio sono collegamenti a Wikimedia Commons, non copie dei file. Ogni audio
mantiene la propria licenza e attribuzione nella relativa pagina `File:`, esposta
nell'app sotto “Fonte audio”. Non assumere che la licenza dei testi valga per gli
audio. La riproduzione usa l'audio relativo alla categoria grammaticale primaria;
i significati alternativi non riutilizzano una pronuncia separata non verificata.

Aggiornamento: `npm run catalog:download`, poi `npm run build`. Per importare nel
database configurato: `npm run seed`. Il server importa automaticamente il
catalogo incluso all'avvio, senza dipendere dalla disponibilità di Kaikki.
Le importazioni usano `$setOnInsert`: una voce già presente non viene riscritta.
