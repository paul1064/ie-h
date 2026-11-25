---
name: scale-it
description: Skaliert das aktuelle Projekt um den Faktor n – n-mal mehr Umfang, n-mal mehr Tragfähigkeit, messbar effizienter. Aufruf `/scale-it -n`, z. B. `/scale-it -10` für Faktor 10. Misst zuerst die Ausgangslage, legt pro Achse ein Ziel fest, baut in geprüften Wellen und meldet den tatsächlich erreichten Faktor. Nutzen, wenn ein Projekt deutlich größer, leistungsfähiger oder umfangreicher werden soll. Triggers: scale-it, scale it, skalieren, hochskalieren, 10x, größer machen, ausbauen, scale up, make it bigger.
argument-hint: "-n   (z. B. -10 = Faktor 10; ohne Angabe: 2)"
---

# Scale-It

Macht aus einem Projekt ein n-mal größeres – ohne dass es n-mal schwerer zu warten wird.

**Leitsatz:** Skaliert wird die *Wirkung* (Umfang, Last, Tempo). Komplexität ist der Preis dafür, nicht das Ziel: jede neue Abstraktion muss einen Faktor tragen, sonst fliegt sie raus.

<!-- INVARIANT START -->
## Invarianten

1. Ohne gemessenen Ausgangswert kein Faktor; Reihenfolge bleibt Fundament → Engpass → Masse → Effizienz.
2. Rote Tests oder verschlechterte Kern-Messwerte stoppen sofort die nächste Welle; Tests werden nie abgeschaltet.
3. Nichts Unumkehrbares oder Kostenpflichtiges ohne ausdrückliche Freigabe.
<!-- INVARIANT END -->

## 0. Argument lesen

- `-10`, `10`, `x10`, `10x` → `n = 10`. Kein Argument → `n = 2`.
- `n < 2` oder keine Zahl → einmal nachfragen, nichts tun.
- Optionaler Fokus nach der Zahl: `/scale-it -10 inhalt` beschränkt auf eine Achse (siehe 2).
- `n > 5` läuft in Stufen von höchstens ×3 (z. B. 10 = ×3 → ×3,3). Nach jeder Stufe wird neu gemessen.

## 1. Ausgangslage messen (nur lesen)

Ohne Zahl kein Faktor. Erfasse zuerst per `node .claude/skills/scale-it/scripts/measure.mjs . --json > /tmp/vorher.json` (später `--compare /tmp/vorher.json`) und Fachbefehlen, was es gibt – nicht per Schätzung:

| Achse | Messgröße (Beispiele) |
|---|---|
| **Umfang** | Features, Endpunkte, Screens, Level, Inhalte, Befehle, unterstützte Formate |
| **Tragfähigkeit** | Datensätze, gleichzeitige Nutzer/Objekte, Dateigröße, Durchsatz bis zum Bruch |
| **Effizienz** | Laufzeit, Speicher, Build-/Testdauer, Kosten pro Vorgang |
| **Absicherung** | Tests, Abdeckung, CI, Typprüfung, Fehlerbehandlung |
| **Struktur** | Module, Kopplung, größte Datei, doppelter Code, hart kodierte Werte |

Projekt ohne Laufzeit (Bibliothek, Skills, Skripte, Doku): Umfang = Einheiten (Skills, Befehle, Seiten), Tragfähigkeit = größte Eingabe bis zum Bruch (künstlich aufblasen, z. B. 2000 Einträge). Zeit plattformneutral mit Shell-`time` messen (`/usr/bin/time` fehlt unter Windows).

Dazu: Projektregeln lesen (`CLAUDE.md`, README, Contributing). Sie gelten vor diesem Skill – verlangt das Projekt Freigaben, Stories oder Design-Dokumente, läuft Scale-It durch diesen Prozess, nicht daran vorbei.

Ergebnis: eine Tabelle „Achse · Messgröße · Ist-Wert · wie gemessen“. Was sich nicht messen lässt, steht als „nicht messbar“ drin, nicht als geratene Zahl.

## 2. Skalierungsplan

Pro Achse ein Ziel aus Ist-Wert × n – und zuerst der Engpass, der bei n bricht:

1. **Engpass finden.** Was hält bei n-facher Größe nicht? (Eine Datei mit allem, O(n²)-Schleife, Handarbeit pro Inhalt, kein Test, alles im Speicher.) Der Engpass kommt vor jedem neuen Feature.
2. **Hebel vor Masse.** n-mal mehr Inhalt entsteht durch Daten, Generatoren und Konfiguration – nicht durch n-mal kopierten Code. Ein Mechanismus, n Ausprägungen.
3. **Effizienz hat eine Richtung.** Laufzeit und Speicher pro Einheit sinken oder bleiben gleich; Gesamtkosten wachsen langsamer als n.
4. **Absicherung wächst mit.** Jede Welle bringt ihre Tests mit. Ein n-faches Projekt ohne n-fache Prüfung ist nur n-mal kaputtbarer.
5. **Streichliste.** Was wird bewusst *nicht* skaliert, und warum.

Plan als Wellen ausgeben: je Welle Ziel, betroffene Dateien, Erfolgssignal (Befehl + erwarteter Wert), grober Aufwand. Erfolgssignale lokal prüfbar halten (Exit-Code, Testlauf); braucht ein Signal Push, Deploy oder CI, das im Plan markieren und die Freigabe dafür mit einholen. Dazu ehrlich: welcher Faktor ist in dieser Sitzung realistisch, welcher braucht mehrere.

**Stopp. Plan zeigen, Freigabe abwarten.** Vorher wird nichts geändert.

## 3. In Wellen bauen

Reihenfolge fest: **Fundament → Engpass → Masse → Effizienz.**

- **Fundament:** Messskripte/Benchmarks und Tests, die den Ist-Zustand festhalten. Ohne sie ist „schneller“ und „größer“ nicht beweisbar.
- **Engpass:** die Struktur, die n trägt (Aufteilung, Datenformat, Schnittstelle).
- **Masse:** Umfang und Inhalt auf dem neuen Fundament ausrollen. Unabhängige Teile parallel an Subagenten geben, jeder mit eigenem Dateibereich und eigenem Erfolgssignal.
- **Effizienz:** messen, den größten Brocken optimieren, wieder messen. Nichts optimieren, was die Messung nicht als Brocken zeigt.

Nach jeder Welle: Tests grün, Messung wiederholt, Zwischenstand in einem Satz. Rote Tests oder ein verschlechterter Messwert stoppen die nächste Welle. Tests werden nie abgeschaltet, um weiterzukommen.

## 4. Abschlussbericht

Tabelle „Achse · vorher · nachher · erreichter Faktor · Ziel n · Beleg“.

- Der erreichte Faktor ist gemessen. `×4 von ×10` ist ein gültiges Ergebnis; „ungefähr ×10“ ohne Beleg ist keines.
- Offen: was fehlt bis n, nächster Engpass, empfohlener Folgeaufruf.
- Neue Risiken: was durch die Größe dazugekommen ist (Abhängigkeiten, Laufzeiten, Wartung).

## Grenzen

- Nichts Unumkehrbares ohne ausdrückliche Freigabe: Datenmigrationen, gelöschte Dateien, öffentliche Schnittstellen, Deployments, Kostenpflichtiges (Cloud, APIs).
- Commits und Pushes nur nach den Regeln des Projekts.
- Kein Aufblähen: Zeilen, Dateien und Abhängigkeiten sind keine Erfolgsgröße. Wächst nur der Code und keine Messgröße aus Schritt 1, ist die Welle gescheitert.
- Passt gut zu `goal-signal-check` (Erfolgssignal vor dem Start, Gegenprobe vor „fertig“).
