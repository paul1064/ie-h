---
name: evolve-it
description: Entwickelt ein Repository oder eine Skill-Sammlung in geprüften Evolutionsschritten weiter – durch Rückwärtsdestillation verstreuter Branches/Läufe, Röntgen der Ausgangslage, Engpass-Fokus, Varianten-Vergleich und harte Gegenprobe. Nutzen bei „evolve-it“, „evolven“, „weiterentwickeln“, „Endmutation bauen“, „Branches destillieren“.
argument-hint: "[ziel-pfad] [--compare vorher.json]"
---
# Evolve-It

Macht aus einem Repository oder verstreuten Entwicklungsständen die nächste belegte Evolutionsstufe: **nichts ungeprüft übernehmen, keine Invariante brechen, jede Verbesserung messen.**

```bash
EV="node .claude/skills/evolve-it/scripts/evolve-check.mjs"
```

<!-- INVARIANT START -->
## Invarianten

1. Reihenfolge fest: Röntgen → Erfolgssignal → Engpass/Rückwärtsdestillation → Umsetzung → Gegenprobe.
2. Öffentliche Schnittstellen, CLI-Flags, Exit-Codes und `<!-- INVARIANT START/END -->`-Blöcke bleiben erhalten.
3. Entferne niemals Authentifizierung, Geheimnis-Schwärzung, Prüfsummen oder Sicherheits-Guards; gesperrte Domänenbegriffe werden strikt ferngehalten.
4. In das Ergebnis kommt nur, was lokal mit grünem Testlauf und Messwert belegt ist – keine Platzhalter, keine TODO-Stümpfe.
<!-- INVARIANT END -->

## Ablauf

1. **Röntgen & Rückwärtsdestillation.**
   - Alle relevanten Branches, Commits und vorhandenen Skills vollständig lesen (keine Annahmen über ungelesene Dateien).
   - Ausgangslage messen und sichern:
     ```bash
     $EV baseline . --out /tmp/vorher.json
     ```
   - Falls mehrere Zweige unterschiedliche Stärken tragen (z. B. Zweig A = Absturzsicherung/Checkpoints, Zweig B = A*-Heuristik/Verifikation), beide Stärken als **verlustfreie Obermenge** planen statt einen Zweig wegzuwerfen.
2. **Engpass nach Wirkung wählen.**
   Rangfolge: (1) rote Prüfung oder Sicherheits-/Hygiene-Lücke, (2) Kernpfad/Skill ohne ausführbare Prüfung, (3) Laufzeit-, Speicher- oder Cache-Flaschenhals (`oracle-first-exploration`, `prompt-cache-check`), (4) Struktur & Dokumentation.
3. **Bauen & Absichern.**
   - Änderungen atomar und ohne externe Abhängigkeiten umsetzen.
   - Jeder neue oder erweiterte Mechanismus bringt seinen eigenen Test (`node --test` / `test.mjs`) mit.
4. **Gegenprobe (`goal-signal-check` + `self-improve`).**
   ```bash
   $EV verify . --baseline /tmp/vorher.json
   ```
   Prüft: alle Tests grün, keine Regression gegenüber `vorher.json`, alle `.self-improve/`-Invarianten intakt, 0 Hygiene-Verstöße.
5. **Lauf protokollieren.** Ist `self-improve` im Repo vorhanden, den Lauf ehrlich per `si.mjs log` festhalten.