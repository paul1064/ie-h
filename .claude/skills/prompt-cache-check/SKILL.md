---
name: prompt-cache-check
description: Prüft Prompt-Caching der Claude API – vor dem Senden (Request-Body lint: Breakpoints ≤ 4, Mindestlänge pro Modell, Zeitstempel/UUIDs vor Breakpoints, TTL-Reihenfolge) und danach (Trefferquote und Kosten aus geloggten usage-Objekten). Nutzen bei „prompt-cache-check“, „cacht mein Prompt?“, „warum ist cache_read 0“, „Caching einbauen“, „API-Kosten senken“, oder wenn Code messages.create aufruft und Caching fehlt.
argument-hint: "request <body.json> | usage <log.jsonl> --model <id> | <code-pfad>"
---

# Prompt-Cache-Check

Ziel: Jeder wiederholte Präfix wird gecacht, und das ist **gemessen**, nicht vermutet.
Spickzettel mit allen Zahlen: `docs/prompt-caching.md`.

```bash
PCC="node .claude/skills/prompt-cache-check/scripts/pcc.mjs"
```

<!-- INVARIANT START -->
## Invarianten

1. Erfolgssignal ist `cache_read_input_tokens > 0` ab der 2. Anfrage – nicht „cache_control steht drin“.
2. Zahlen (Mindestlängen, Faktoren, Limits) kommen aus der offiziellen Doku; bei Widerspruch gewinnt die Doku, und `pcc.mjs` wird angepasst.
3. Keine API-Schlüssel in Beispiele, Logs oder Commits.
<!-- INVARIANT END -->

## Ablauf

1. **Modus wählen.**
   - Request-Body als JSON vorhanden → Schritt 2.
   - Nur Code (`messages.create`, `client.messages`, `anthropic.`) → Body aus dem Code als JSON nachbauen (Platzhalter für variable Teile, aber echte Länge der festen Texte), nach Scratchpad schreiben → Schritt 2.
   - Logs/usage-Objekte vorhanden → Schritt 3.
2. **Request prüfen:** `$PCC request body.json [--model id]`
   - `ERROR` = API-Fehler oder Cache wirkt nie → zuerst beheben.
   - `WARN` = Cache wirkt still nicht oder bricht jede Anfrage.
   - Exit 0 = keine ERROR.
3. **Messen:** `$PCC usage log.jsonl --model id [--min-hit 0.5]`
   - Eine Zeile pro Response (ganze Response oder nur `usage`).
   - Ohne Logs: zwei identische Anfragen nacheinander senden (Nutzer fragen, ob echte API-Aufrufe ok sind) und `usage` beider notieren.
4. **Fixen** – nach der Reihenfolge unten, eine Ursache pro Schritt, danach 2 und 3 wiederholen.
5. **Melden:** Trefferquote vorher/nachher, Kostenfaktor, was geändert wurde, was nur geschätzt ist (Token-Schätzung = Zeichen/4).

## Typische Fixes (häufigste zuerst)

| Befund | Fix |
|---|---|
| Kein `cache_control` | `cache_control={"type": "ephemeral"}` auf oberster Ebene (automatisch; nicht Bedrock) |
| Präfix < Minimum | Mehr Stabiles nach vorne (Beispiele, Doku) oder Caching hier weglassen |
| Zeitstempel/UUID/Nutzername im `system` | In die letzte User-Nachricht verschieben |
| Tools ändern sich pro Anfrage | Feste, sortierte Tool-Liste; `tool_choice` statt Tool entfernen |
| `rewrites` > 0 in `usage` | Präfix zwischen zwei Anfragen diffen; JSON-Schlüsselreihenfolge stabil halten |
| > 4 Breakpoints / 1h nach 5m | Breakpoints zusammenlegen; 1h-Blöcke vor 5m-Blöcke |
| Pausen > 5 min zwischen Anfragen | `"ttl": "1h"` (Schreiben 2x statt 1,25x) |

## Grenzen

- `pcc.mjs` schätzt Token (Zeichen/4) – im Zweifel `count_tokens`-Endpoint nutzen.
- Erkennt nur offensichtlich variable Inhalte (Zeitstempel, UUID, „heute ist“). Andere Präfix-Änderungen zeigt erst `usage` (`rewrites`).
- Modell-Tabellen in `pcc.mjs` Stand 2026-11-24; unbekanntes Modell → INFO, keine Mindestlängenprüfung.
