# Spickzettel: Prompt-Caching (Claude API)

Quelle: <https://platform.claude.com/docs/de/build-with-claude/prompt-caching.md> · Stand: 2026-11-24
Punkte mit ⚠ wurden nur aus einer Zusammenfassung übernommen – vor Nutzung im Original prüfen.

## Einschalten

**Automatisch** – ein `cache_control` auf oberster Ebene, Breakpoint wandert mit dem Gespräch mit (nicht auf Bedrock):

```python
response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=1024,
    cache_control={"type": "ephemeral"},
    system="...",
    messages=[{"role": "user", "content": "..."}],
)
print(response.usage.model_dump_json())
```

**Explizit** – `cache_control` auf einzelnen Blöcken in `tools`, `system` oder `messages`:

```python
system=[{"type": "text", "text": LANGER_TEXT, "cache_control": {"type": "ephemeral"}}]
```

- Max. **4 Breakpoints** pro Prompt; automatisches Caching belegt einen davon (4 explizite + automatisch → 400).
- Lookback: 20 Blöcke pro Breakpoint.
- Breakpoint auf den **letzten Block, der zwischen Anfragen gleich bleibt** – nie auf Zeitstempel oder Nutzereingaben.

## TTL & Preise (Faktor auf Basis-Input-Preis)

| | Faktor |
|---|---|
| Schreiben, 5 min (Standard) | 1,25x |
| Schreiben, 1 h (`"ttl": "1h"`) | 2x |
| Lesen – Fable/Mythos 5.1, 5.2 | 0,025x |
| Lesen – Opus 5.5, Sonnet 5.5 | 0,05x |
| Lesen – alle anderen | 0,1x |

TTL verlängert sich bei jedem Treffer kostenlos. Breakpoints selbst kosten nichts.

## Mindestlänge (sonst wird still nicht gecacht)

| Token | Modelle |
|---|---|
| 512 | 5er-Generation (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable/Mythos 5.x, Opus 5) |
| 1.024 | Opus 4.8, Sonnet 5, Sonnet 4.x, Opus 4/4.1 |
| 2.048 | Mythos Preview, Opus 4.7 |
| 4.096 | Opus 4.5/4.6, Haiku 4.5 |

## Was den Cache bricht

Reihenfolge **tools → system → messages**. Änderung auf einer Ebene invalidiert sie und alles danach.

| Änderung | tools | system | messages |
|---|---|---|---|
| Tool-Definitionen | ✘ | ✘ | ✘ |
| Websuche / Zitate an/aus | ✓ | ✘ | ✘ |
| `speed: "fast"` vs. Standard | ✓ | ✘ | ✘ |
| `tool_choice`, Bilder | ✓ | ✓ | ✘ |
| Thinking-Parameter, `output_config.effort` | modellabh. | modellabh. | ✘ |

Außerdem: andere JSON-Schlüsselreihenfolge ⚠, abgelaufene TTL.

## Treffer prüfen (`response.usage`)

- `cache_creation_input_tokens` – geschrieben
- `cache_read_input_tokens` – gelesen
- beide 0 → nicht gecacht
- `input_tokens` = nur Token **nach** dem letzten Breakpoint
- Gesamt = `cache_read + cache_creation + input_tokens`
- ⚠ `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` getrennt

## Tricks

- **Vorwärmen:** `max_tokens: 0` ⚠ (nicht mit Streaming, Thinking, Structured Output, Batches).
- **Parallele Anfragen:** Cache steht erst, wenn die erste Antwort beginnt → erst eine schicken, dann den Rest.
- **Batches:** Treffer nur best effort → Präfix vorher mit 1h-TTL vorwärmen.
- **System-Nachricht mitten im Gespräch:** `{"role": "system"}` in `messages` bricht den Cache nicht ⚠ (nicht Sonnet 5).
- Kein manuelles Leeren; Cache ist pro Organisation isoliert.

## Faustregel

Lohnt sich ab dem **2. Treffer** (1,25x einmal zahlen, danach ≤ 0,1x). Stabiles nach vorne, Variables nach hinten.
