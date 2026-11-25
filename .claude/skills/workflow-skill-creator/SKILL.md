---
name: workflow-skill-creator
description: Destilliert aus realen Arbeitsabläufen, Postmortems oder Hackathon-Durchläufen einen präzisen, prüfbaren Skill (SKILL.md + optionales Zero-Dep-Skript + Invarianten-Schutz). Übernimmt den Stil des Ziel-Repositories, prüft Frontmatter, Zeilenbudget, Dateiverweise sowie Geheimnis- und Begriffs-Hygiene. Nutzen bei „workflow-skill-creator“, „mach daraus einen Skill“, „Skill erstellen“, „Workflow destillieren“.
argument-hint: "<skill-name> [--dir .claude/skills]"
---
# Workflow-Skill-Creator

Baut aus echten Durchläufen und belegten Fehlern einen knappen, ausführbaren Skill – ohne Theorie-Ballast und ohne fremde Abhängigkeiten.

```bash
WSC="node .claude/skills/workflow-skill-creator/scripts/scaffold.mjs"
```

<!-- INVARIANT START -->
## Invarianten

1. Jede Regel im Skill stammt aus einem realen Befund, Fehler oder Messwert – keine allgemeinen Ratschläge.
2. Keine Geheimnisse, Tokens, E-Mail-Adressen, lokalen Nutzerpfade oder gesperrten Domänenbegriffe im Skill oder Repository.
3. `name` im YAML-Frontmatter stimmt exakt mit dem Ordnernamen überein; `description` ≤ 1024 Zeichen, `SKILL.md` ≤ 200 Zeilen.
4. Mitgelieferte Skripte laufen unter Node ≥ 18 ohne externe Pakete und werden vor Abschluss real ausgeführt.
<!-- INVARIANT END -->

## Ablauf

1. **Ziel-Repository röntgen.** Vorhandene `SKILL.md`-Dateien, `CLAUDE.md`, `README.md` und `.claude-plugin/` lesen. Sprache, Gliederung, Invarianten-Format und Test-Konvention übernehmen. Deckt ein vorhandener Skill das Thema bereits ab, diesen gezielt erweitern statt ein Duplikat anzulegen.
2. **Kern destillieren (Rückwärtsdestillation).**
   - Welcher konkrete Fehler, Zeitverlust oder Köder trat im echten Lauf auf?
   - Was ist das harte Erfolgssignal (`goal-signal-check`), woran erkennt man den Erfolg maschinell?
   - Gehört wiederkehrende Mechanik in ein kleines Skript (`scripts/*.mjs`), statt den Agenten jedes Mal Code neu tippen zu lassen?
3. **Gerüst anlegen oder prüfen:**
   ```bash
   $WSC init <ziel-ordner>/<skill-name> --description "Was der Skill tut und wann man ihn nutzt"
   ```
4. **Inhalt schärfen.** Kurz schlägt vollständig (Ziel: in unter 2 Minuten lesbar):
   - Frontmatter mit klaren Auslösern (`description`, optional `argument-hint`).
   - `<!-- INVARIANT START --> ... <!-- INVARIANT END -->` für Sicherheits- und Qualitätsgrenzen, die auch `self-improve` niemals wegoptimieren darf.
   - Nummerierter Ablauf mit kopierbaren Befehlen und klaren Exit-Codes.
5. **Validieren & einbinden:**
   - `$WSC lint <ziel-ordner>/<skill-name>` (prüft Frontmatter, Zeilenbudget, Dateiverweise, Hygiene-Sperrliste).
   - Falls `.self-improve/` im Projekt aktiv ist: `node .claude/skills/self-improve/scripts/si.mjs init <ziel-ordner>/<skill-name>` und `check`.
   - `README.md` und ggf. `.claude-plugin/plugin.json` nachziehen.