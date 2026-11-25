---
name: fuse
description: Verschmilzt zwei oder mehr Repositories bzw. Entwicklungszweige verlustfrei zu einem einheitlichen Ziel-Repository. Vereint konkurrierende Module zur Funktions-Obermenge, schneidet Altlasten und gesperrte Begriffe heraus, vereinheitlicht Ordnerstruktur, Manifeste und CI und weist nach, dass alle Fähigkeiten und Tests beider Quellen im Ziel grün laufen. Nutzen bei „fuse“, „verschmelzen“, „Repos zusammenführen“, „merge repos into new repo“.
argument-hint: "<quelle-a> <quelle-b> --into <ziel-verzeichnis>"
---
# Fuse

Verschmilzt zwei oder mehr Projekte zu einem stärkeren Ganzen – **ohne Fähigkeitsverlust, ohne doppelte Pflegepfade und mit bewiesener Gegenprobe beider Quellen.**

```bash
FA="node .claude/skills/fuse/scripts/fuse-audit.mjs"
```

<!-- INVARIANT START -->
## Invarianten

1. Keine Fähigkeit und kein Test einer Quelle geht stillschweigend verloren; wird etwas bewusst verworfen (z. B. Sicherheits- oder Hygiene-Ausschluss), steht es explizit im Fusionsbericht.
2. Konkurrierende Varianten derselben Datei werden zur **Funktions-Obermenge** zusammengeführt – niemals blind per Datei-Überschreibung plattgemacht.
3. Eine einzige Wahrheit pro Ressource im Ziel-Repo (keine doppelten Skill- Kopien an zwei Orten ohne klare Spiegelung/Prüfung).
4. Vor dem Push ins Ziel-Repository laufen sämtliche Tests, Invarianten-Checks und `fuse-audit.mjs` mit Exit 0.
<!-- INVARIANT END -->

## Ablauf

1. **Quellen inventarisieren.**
   Beide Quell-Repositories vollständig lesen: Ordnerlayout (`.claude/skills/` vs. `skills/`), Manifeste (`.claude-plugin/`), Regeln (`CLAUDE.md`), Lizenz, CI-Workflows, Skripte und Tests.
2. **Konflikte als Obermenge lösen.**
   - Gleicher Skill/gleiches Modul mit unterschiedlichen Features? Schnittstellen und Optionen zusammenführen (Beispiel: Streaming-Checkpoints + A*-Suche in einem `explore.mjs`).
   - Strengere Sicherheits- und Qualitätsregeln gewinnen immer (z. B. `self-improve`-Invarianten-Hashes + Hygiene-Sperrliste für alle Skills aktivieren).
3. **Ziel-Architektur aufbauen.**
   - Einheitlicher Kanon-Pfad für Skills, Skripte, Beispiele, Dokumentation und zentrale Test-Pipeline (`npm test` + GitHub Actions).
   - Lizenz- und Urheberhinweise sauber übernehmen.
4. **Fusions-Audit ausführen:**
   ```bash
   $FA --sources <quelle-a> <quelle-b> --target <ziel>
   ```
   Prüft automatisch, dass jeder Skill aus allen Quellen im Ziel vorhanden, valide, frei von gesperrten Begriffen/Geheimnissen und mit `.self-improve/` abgesichert ist.
5. **Gesamttest & Ziel-Push.**
   Alle Tests + `goal-signal-check` (`verify.mjs`) im Ziel-Repository ausführen; erst bei 0 Fehlern committen und in das neue GitHub-Repository pushen.