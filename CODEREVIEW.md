# Code-Review-Aufgabenliste

Gepflegte To-do-Liste aus Code-Reviews (siehe AGENTS.md). Erledigte Punkte werden
mit ✅, Datum und kurzem Kommentar markiert.

Hinweis: Die ursprüngliche Datei mit den Einträgen 1–16 war nicht im Repository
und ist verloren gegangen. Die Nummern 17 und 18 sind aus den Verweisen in
AGENTS.md rekonstruiert; neue Einträge werden ab 19 fortgezählt.

| Nr. | Thema | Status |
| --- | --- | --- |
| 17 | ESLint-Altbestand: bekannter Rückstand an Lint-Findings im Bestandscode. Keine neuen Findings einführen; Altbestand nicht nebenbei mitfixen. | offen |
| 18 | knip-Altbestand: gemeldete tote Dateien/Exports/Typen (`npm run check:unused`); False-Positive-Einstiegspunkte stehen in `knip.json`. | offen |
| 19 | Custom Node: Nutzer-Code läuft ohne Zeitlimit im UI-Hauptthread (`src/nodes/custom-node/runtime.ts`). Eine Endlosschleife (z. B. vom Assistenten generiertes `while(true)`) friert die ganze App ein. Lösung: Ausführung in einen Web Worker mit Timeout auslagern; die `llm`/`llmJson`-Aufrufe müssen dann per Message-Passing zum Hauptthread zurück. Größerer Umbau. (Gefunden im Custom-Node-Review am 2026-07-05.) | offen |
