---
name: oracle-first-exploration
description: Ein langsames oder undurchsichtiges System (Web-UI, API, Rätsel, Spiel, Konfig-Labyrinth, Build) nicht von Hand durchprobieren, sondern seine Entscheidungslogik als schnelles Headless-Orakel nachbauen, den Zustandsraum per BFS durchsuchen (Fallen, Köder, Sackgassen werden automatisch gemeldet) und das Ergebnis am Ende einmal im echten System gegenprüfen. Nutzen bei „finde den Weg“, „knack das Rätsel“, „probier alle Kombinationen“, „warum kommt X nur manchmal“, CTF/Escape-Room/Easter-Egg, oder wenn du merkst, dass du dieselbe UI-Aktion zum dritten Mal klickst. Triggers: explore state space, brute force, puzzle, try combinations, search, oracle, simulator.
---

# Oracle-first Exploration

**Kernidee:** Probier nicht im langsamen Echtsystem. Bau ein schnelles Orakel, such dort systematisch, prüf den Fund **einmal** im Echtsystem.

Gemessen an einem realen Web-Rätsel (verschlüsselter Tresor, ~200 Einträge, Zustandsketten):

| Weg | Kosten pro Versuch | Ergebnis |
|---|---|---|
| Browser klicken | ~10 s | langsam, fehleranfällig |
| Headless-Orakel | ~0,1 s, parallel | 4⁴-Labyrinth in 0,3 s, 9-Schritt-Pfad in 1,4 s |

<!-- INVARIANT START -->
## Invarianten

1. Das Orakel läuft rein lesend und lokal; das Echtsystem wird erst zur einmaligen Gegenprobe des Gewinnerpfads berührt.
2. Plausibler Text zählt nie als Erfolg – `goal` wird ausschließlich an einem harten Signal festgemacht.
3. Nur in Systemen anwenden, für die ausdrückliche Erlaubnis vorliegt (eigene Projekte, CTFs, freigegebene Tests).
<!-- INVARIANT END -->

## Ablauf

1. **Wahrheit lesen, nicht Oberfläche.** Quelltext, Netzwerk-Antworten, Config, Logs. Kommentare und „toter“ Code sind oft die eigentlichen Regeln. Hinweise im UI sind verlustbehaftet – sie können absichtlich auf einen Köder zeigen.
2. **Orakel extrahieren.** Die kleinste Funktion nachbauen, die *Eingabe → Wirkung* beantwortet (Validierung, Entschlüsselung, Zustandsübergang, Endpunkt). Nur lesend; das Original bleibt unangetastet.
3. **Orakel kalibrieren.** 2–3 bekannte Eingaben durchs Orakel *und* durchs Echtsystem schicken. Abweichung = Orakel falsch, nicht weitersuchen.
4. **Adapter schreiben** (`initial`, `actions`, `step`, optional `key`) – Vorlage: `${CLAUDE_SKILL_DIR}/examples/toy-adapter.mjs`.
5. **Suchen:**
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/explore.mjs" mein-adapter.mjs --depth 12 --nodes 5000 [--mode bfs|astar] [--checkpoint lauf.ck]
   ```
   Ausgabe: kürzester bzw. günstigster Pfad (`cost`/`heuristic` bei `astar`), Fallen, tote Kandidaten, Statistik; `--checkpoint` sichert mit SHA-256 + `.bak` und setzt nach Abbruch nahtlos fort. Exit 0 = Ziel gefunden.
   Steht unter „nie wirksam“ eine Aktion, die sicher wirkt: Fehler im Orakel (meist fehlt der Effekt in `key`/Zustand), nicht Kandidat streichen. Zurück zu 3.
6. **Gegenprobe im Echtsystem.** Den gefundenen Pfad genau einmal real ausführen und das *echte* Erfolgssignal prüfen (siehe Skill `goal-signal-check`).

## Adapter-Regeln

- `step` gibt `null` zurück, wenn eine Aktion nichts bewirkt. Das spart Knoten und meldet tote Kandidaten.
- Markiere Fallen explizit mit `trap: "Grund"`: Schleifen mit riesigem `n`, „zurück zum Start“, Aktionen ohne Belohnung. Lies dafür, **was** ein Zweig am Ende liefert, bevor du Zeit hineinsteckst.
- `goal` nur bei einem harten Signal setzen (Flag gesetzt, Status 200 mit Inhalt X, Level-Wert) – nie bei „Text klingt nach Fortschritt“.
- Frühe Entscheidungen (Captcha, Rolle, Modus) gehören in den **Zustand**. Sie können 20 Schritte später als Voraussetzung auftauchen.
- `key(state)` muss alles enthalten, was das Verhalten beeinflusst, sonst verschluckt die Deduplizierung echte Wege.

## Kandidaten finden

Die Suche ist nur so gut wie `actions()`. Quellen, in dieser Reihenfolge:
1. Wörter, die das System selbst anbietet (Menüs, „rauf | runter“, Fehlermeldungen, Regex in Antworten).
2. Verben/Nomen aus Hinweistexten, in Varianten (Infinitiv, Imperativ, mit/ohne Objekt).
3. Kulturelle Muster: Wirkt eine Hinweiskette wie ein bekannter Trick (Glitch aus einem Spiel, Code-Folge, Chiffre)? Dann dessen Vokabular übernehmen.
Mehr Kandidaten kosten nur Rechenzeit; fehlende kosten den Fund.

## Gotchas

- **Plausibler Output ist kein Erfolg.** Eine Entschlüsselung mit dem „fast richtigen“ Schlüssel lieferte lesbaren Klartext – aber kein Siegel. Erst die Variante mit Sonderzeichen (Umlaut als *ein* Zeichen) zählte. Immer das Wirkungssignal prüfen.
- **Sackgassen sehen aus wie Fortschritt.** Ein Zweig bot eine Schleife mit 10¹⁵ Runden an und belohnte am Ende mit „nichts“. Vor dem Abarbeiten: Schleifengröße und Belohnung lesen.
- **Orakel ≠ Wahrheit.** Abweichungen bei Normalisierung (Groß/klein, Unicode NFC, Umlaute, Leerzeichen) sind die häufigste Fehlerquelle. Deshalb Schritt 3 und 6.
- Teure `step`-Funktionen (Krypto, Netz) über `--conc` parallelisieren; Rate-Limits des Echtsystems nicht vergessen – das Orakel sollte lokal laufen.
- Nur in Systemen anwenden, für die du die Erlaubnis hast (eigene Projekte, CTFs, freigegebene Tests).
