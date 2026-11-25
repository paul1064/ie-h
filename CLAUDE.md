# ie-h — Intelligence Explosion Hackathon (Endmutation)

Acht rückwärtsdestillierte, selbstverbessernde Agent-Skills in `.claude/skills/` (Node ≥ 18, null externe Abhängigkeiten).

## Regeln

1. **Kein Edit ohne Messung & Invarianten-Check:** Alle Skills stehen unter SHA-256-Schutz (`<!-- INVARIANT START/END -->` + `.self-improve/`).
2. **Rekursions-Regel:** Nach jedem abgeschlossenen Lauf eines Skills aus `.claude/skills/` wird `self-improve` mit dessen Namen ausgeführt; nach `self-improve` selbst höchstens einmal pro Aufgabe (keine Endlosschleife).
3. **Hygiene-Sperre:** Keine API-Schlüssel, Tokens, personenbezogenen Pfade oder gesperrten Domänenbegriffe im Repository (`npm run check` bricht bei Verstoß sofort mit Exit 1 ab).
