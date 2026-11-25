---
name: self-improve
description: Verbessert nach jedem Lauf eines Skills dessen SKILL.md – auch die eigene. Protokolliert den Lauf (Ergebnis, Reibungspunkte), macht höchstens eine belegte Änderung, sichert vorher einen Snapshot, zählt die Version hoch und rollt zurück, wenn die neue Version schlechter abschneidet. Nutzen am Ende jedes Laufs eines Skills aus .claude/skills, bei „self-improve“, „verbessere den Skill“, „lern aus dem Lauf“.
argument-hint: "[skill-name]   (ohne Angabe: der zuletzt benutzte Skill, sonst self-improve selbst)"
---

# Self-Improve

Nach jedem Lauf wird der Skill ein bisschen besser, und zwar nur dort, wo der Lauf es belegt.

Zuerst als Shell-Variablen setzen (im Bash-Tool ist `CLAUDE_SKILL_DIR` oft leer, daher Repo-Pfad):
```bash
SI="node .claude/skills/self-improve/scripts/si.mjs"; DIR=.claude/skills/<ziel-skill>
```
Dann `$SI <befehl> $DIR`.

<!-- INVARIANT START -->
## Invarianten (dieser Block wird nie geändert, auch nicht von self-improve selbst)

1. Kein Befund, keine Änderung. Jede Änderung zitiert einen Lauf mit mindestens einem Reibungspunkt.
2. Höchstens eine Änderung pro Lauf, damit Wirkung und Ursache zuordenbar bleiben.
3. Vor jeder Änderung `snapshot`, danach `bump`, zum Schluss `check` mit Exit 0.
4. Geändert wird nur `SKILL.md` des Ziel-Skills. Nie `scripts/`, nie `.self-improve/` von Hand, nie diesen Block.
5. Zeigt `trend` eine Regression (Exit 3), wird zurückgerollt (`revert`), nicht weiter verbessert.
6. Commit und Push nur, wenn der Nutzer es verlangt.
<!-- INVARIANT END -->

## Ablauf

1. **Ziel bestimmen.** Argument, sonst der zuletzt benutzte Skill dieser Sitzung, sonst `self-improve`. Fehlt `DIR/.self-improve/`: `SI init DIR`.
2. **Lauf protokollieren.** Ehrlich, aus dem tatsächlichen Verlauf, nicht aus dem Gefühl:
   ```bash
   SI log DIR --outcome ok|partial|fail --task "Ziel in einem Satz" --friction "konkreter Reibungspunkt" ...
   ```
   `ok` = Ziel des Laufs erreicht · `partial` = Ziel nur teilweise erreicht oder Lauf endete planmäßig vorher (z. B. Freigabe-Stopp) · `fail` = Ziel verfehlt oder Nutzer musste korrigieren.
   Reibungspunkt = Stelle, an der die SKILL.md fehlte, unklar war, in die Irre führte oder unnötig Zeit kostete. Zitierbar: Schritt, Fehlermeldung, Nutzer-Korrektur. Kein Reibungspunkt → kein `--friction`, weiter bei 6.
3. **Trend prüfen.** `SI trend DIR`. Exit 3 → `SI revert DIR`, dann 6.
4. **Eine Änderung wählen**, die den stärksten Reibungspunkt behebt. Vorrang: streichen oder schärfen vor ergänzen. Ein Satz, der nicht wirkt, fliegt raus.
5. **Ändern:** `SI snapshot DIR` → SKILL.md editieren → `SI bump DIR --run rN --change "was und warum, ein Satz"`.
6. **Prüfen:** `SI check DIR` muss Exit 0 liefern. Sonst Änderung zurücknehmen (Snapshot) und Grund melden.
7. **Melden** in drei Zeilen: Lauf-ID und Ergebnis · Änderung (oder „keine, kein Befund“) · neue Version.

## Rekursion

self-improve ist selbst ein Skill. Nach jedem eigenen Lauf zielt es auf sich selbst: Wo hat diese Anleitung gerade gehakt? Die Invarianten verhindern, dass es dabei seine eigenen Sicherungen wegoptimiert.
