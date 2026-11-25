// Beispiel API: einen REST-Ablauf erkunden, ohne den echten Server zu belasten.
//   node ../scripts/explore.mjs api-adapter.mjs           (aus dem examples-Ordner)
// Das "Orakel" ist hier ein lokaler Nachbau der Server-Regeln (in echt: aus OpenAPI-Spec,
// Quelltext oder 2-3 kalibrierten Echt-Requests ableiten). Gesucht: der kürzeste Weg zu einem
// bezahlten Auftrag. Fallen: ein Endpunkt, der den Warenkorb leert, und ein Rate-Limit.

// Nachgebaute Server-Logik: (Zustand, Request) -> { status, state }
function server(s, req) {
  switch (req) {
    case "POST /login":    return s.token ? { status: 409 } : { status: 200, state: { ...s, token: true } };
    case "POST /cart":     return s.token ? { status: 201, state: { ...s, items: s.items + 1 } } : { status: 401 };
    case "DELETE /cart":   return { status: 204, state: { ...s, items: 0 } };
    case "POST /checkout": return s.token && s.items > 0 && !s.order ? { status: 201, state: { ...s, order: "offen" } } : { status: 400 };
    case "POST /pay":      return s.order === "offen" ? { status: 200, state: { ...s, order: "bezahlt" } } : { status: 402 };
    case "GET /admin":     return { status: 429 }; // Rate-Limit: jeder Versuch kostet nur
    default:               return { status: 404 };
  }
}

export const initial = { token: false, items: 0, order: null };
export const actions = () => ["POST /login", "POST /cart", "DELETE /cart", "POST /checkout", "POST /pay", "GET /admin"];
export const key = (s) => `${s.token}|${Math.min(s.items, 2)}|${s.order}`; // 2+ Artikel verhalten sich gleich

export async function step(s, req) {
  const r = server(s, req);
  if (r.status === 429) return { state: s, trap: "Rate-Limit, bringt nichts" };
  if (r.status >= 400) return null;                         // keine Wirkung
  if (req === "DELETE /cart" && s.items > 0) return { state: r.state, trap: "leert den Warenkorb (zurück zum Start)" };
  if (r.state.order === "bezahlt") return { state: r.state, goal: true, note: "Auftrag bezahlt (Signal: order=bezahlt, HTTP 200)" };
  return { state: r.state, note: `${req} -> ${r.status}` };
}
