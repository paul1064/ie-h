---
name: goal-signal-check
description: Kurze Pflicht-Checkliste für agentische Aufgaben – vor dem Start (Ziel, Schreibrechte, messbares Erfolgssignal), während der Arbeit (Köder, Sackgassen, Budget, irreversible Entscheidungen) und vor dem „fertig“ (Gegenprobe im Echtsystem). Nutzen am Anfang jeder mehrstufigen Aufgabe, bevor ein generischer Skill auf ein konkretes Ziel angewendet wird, wenn ein Ergebnis „gut aussieht“ aber nicht geprüft ist, oder wenn man sich festgefahren fühlt. Triggers: plan task, before starting, am I done, verify, stuck, scope, read-only.
---

# Goal-Signal-Check

Drei Stationen, je ein paar Sekunden. Entstanden aus konkreten Fehlern, nicht aus Theorie.

<!-- INVARIANT START -->
## Invarianten

1. Kein „fertig“ ohne echte Gegenprobe am beobachtbaren Signal (Exit-Code, Datei, Zähler, Testlauf).
2. Ungeklärte Schreibrechte bedeuten strikt nur lesen; bei Unterbrechung durch den Nutzer sofort stoppen.
3. Keine Schlüssel, persönlichen Daten oder Interna Dritter in Commits, Logs oder öffentlichen Repos.
<!-- INVARIANT END -->

## 1. Vor dem Start

- **Ziel in einem Satz, in den Worten des Nutzers.** Passt der gewählte Skill/Workflow zu *diesem* Satz – oder nur zum Stichwort? (Realer Fehler: Ein „mach einen Skill aus diesem Projekt“-Generator wurde gestartet, obwohl der Nutzer Lernerkenntnisse über den eigenen Arbeitsstil wollte. Folge: unerwünschte Änderung am Repo.)
- **Schreibrechte klären.** Darf ich ändern, oder nur lesen? Im Zweifel: nur lesen, Arbeitsdateien in ein eigenes Scratch-Verzeichnis. Gefundene Fehler **melden**, nicht ungefragt fixen.
- **Erfolgssignal festlegen, bevor gehandelt wird.** Ein beobachtbarer Zustand (Flag, Exit-Code, Zähler, Datei existiert, Test grün) – nicht „Ausgabe klingt richtig“.
- **Budget setzen.** Wie viele Versuche/Minuten, bevor ich die Strategie wechsle statt weiterzumachen?

## 2. Während der Arbeit

- **Köder-Test:** Hat der letzte Schritt das Erfolgssignal bewegt – oder nur plausiblen Text erzeugt? Hinweise können absichtlich in die Irre führen; die Quelle (Code, Daten) schlägt die Beschreibung.
- **Sackgassen-Test:** Bevor du in einen langen Zweig investierst – was liefert er am Ende? Schleifen mit riesigem `n`, „zurück zum Anfang“, „nichts dahinter“ sofort abbrechen.
- **Dritte Wiederholung = Werkzeug bauen.** Wer dieselbe manuelle Aktion zum dritten Mal macht, baut ein Skript/Orakel (siehe `oracle-first-exploration`).
- **Irreversible Frühentscheidungen festhalten.** Antworten auf frühe Fragen (Rolle, Captcha, Modus) notieren und Zustand vor solchen Weichen sichern (Snapshot), damit du zurückspringen kannst statt neu anzufangen.
- **Unterbrechung des Nutzers = Stopp + Rückfrage-Ersatz:** Sofort aufhören, die eigenen Änderungen zurücknehmen, das Missverständnis in einem Satz benennen, dann auf dem korrigierten Ziel weiter.

## 3. Vor „fertig“

- **Gegenprobe im Echtsystem**, nicht nur im Modell/Simulator/Test (`node .claude/skills/goal-signal-check/scripts/verify.mjs --cmd "<befehl>" --stdout "<signal>" [--git-clean]`).
- **Diff prüfen:** Habe ich etwas geändert, das ich nicht ändern sollte? (`git status` bzw. `--git-allow` muss zur Absprache passen.)
- **Ergebnis ehrlich melden:** Was ist verifiziert, was nur vermutet, was übersprungen.
- **Bei öffentlichen Ergebnissen** (Skills, Posts, Repos): keine persönlichen Daten, keine Schlüssel, keine Spoiler/Interna Dritter.
