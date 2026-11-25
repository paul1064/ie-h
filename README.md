# ie-h — Intelligence Explosion Hackathon (Endmutation)

Endmutation der aus realen Hackathon-Durchläufen (`commit24` Web-Rätsel) und `ult-ie` rückwärtsdestillierten Agent-Skills: Headless-Orakel-Suche (BFS & A* mit >16,7 Mio. Zuständen und SHA-256-Checkpoints), harte Erfolgssignal-Prüfung, Prompt-Cache-Analyse, rekursive Selbstverbesserung, Skill-Destillation, Evolution und Repository-Fusion.

Alle acht Skills laufen unter **Node ≥ 18 ohne externe Pakete** und werden durch SHA-256-Invarianten (`self-improve`) sowie automatische Hygiene-Prüfungen abgesichert.

## Enthaltene Skills (8)

| Skill | Skript | Kernaufgabe |
|---|---|---|
| `oracle-first-exploration` | `scripts/explore.mjs` | Langsame oder undurchsichtige Systeme als schnelles Headless-Orakel nachbauen, per BFS oder A* durchsuchen (inkl. Sharded-Set, Retries & `.bak`-Checkpoint) und einmal im Echtsystem gegenprüfen. |
| `goal-signal-check` | `scripts/verify.mjs` | Drei-Stationen-Pflichtprüfung mit maschineller Gegenprobe (Exit-Code, Ausgabe-Regex, Köder-Ausschluss, erlaubte Git-Pfade). |
| `scale-it` | `scripts/measure.mjs` | Projekt entlang fünf Achsen messen (`--json` / `--compare`) und in geprüften Wellen um Faktor `n` skalieren. |
| `self-improve` | `scripts/si.mjs` | Läufe protokollieren, höchstens eine belegte Änderung an `SKILL.md` vornehmen, Invarianten per SHA-256 schützen und bei Regression automatisch zurückrollen. |
| `prompt-cache-check` | `scripts/pcc.mjs` | Claude-API-Requests vorab auf Cache-Fehler prüfen und echte Trefferquote sowie Kostenersparnis aus `usage`-Logs berechnen. |
| `workflow-skill-creator` | `scripts/scaffold.mjs` | Aus realen Durchläufen und Fehlern neue Skills mit Frontmatter-, Zeilenbudget- und Hygiene-Prüfung erzeugen. |
| `evolve-it` | `scripts/evolve-check.mjs` | Verstreute Branches und Erkenntnisse mit Baseline-Vergleich und Invarianten-Prüfung zur nächsten Evolutionsstufe verdichten. |
| `fuse` | `scripts/fuse-audit.mjs` | Zwei oder mehr Repositories verlustfrei zur Funktions-Obermenge verschmelzen und Vollständigkeit wie Hygiene maschinell auditieren. |

## Schnellstart & Prüfung

```bash
# Alle Unit-Tests + Invarianten- und Hygiene-Checks ausführen
npm test

# Zustandsraum-Explorer testen (BFS & A*)
node .claude/skills/oracle-first-exploration/scripts/explore.mjs .claude/skills/oracle-first-exploration/examples/labyrinth.mjs
node .claude/skills/oracle-first-exploration/scripts/explore.mjs .claude/skills/oracle-first-exploration/examples/game-adapter.mjs --mode astar --depth 30

# Ausgangslage messen
npm run measure
```

## Lizenz

MIT – siehe [LICENSE](LICENSE).
