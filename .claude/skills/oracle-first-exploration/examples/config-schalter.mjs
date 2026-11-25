// Sechs Konfig-Schalter, der Build ist nur bei einer bestimmten Kombination grün.
// Zeigt: Abhängigkeiten zwischen Schaltern als Regeln im Orakel, ein hartes Zielsignal
// (Exit-Code des Builds), und eine Kombination, die das System unbrauchbar macht (Falle).
//   node scripts/explore.mjs examples/config-schalter.mjs
const FLAGS = ["cache", "tls", "http2", "gzip", "debug", "legacy"];
export const initial = { on: [] };

function build(on) {
  const has = (f) => on.includes(f);
  if (has("http2") && !has("tls")) return 1;       // http2 braucht tls
  if (has("gzip") && has("debug")) return 1;       // schließen sich aus
  if (has("legacy")) return 1;
  return has("cache") && has("http2") && has("gzip") ? 0 : 1;
}

export function actions() {
  return [...FLAGS.map((f) => "schalte:" + f), "bauen"];
}

export async function step(s, a) {
  if (a === "bauen") return build(s.on) === 0 ? { state: s, goal: true, note: "Build grün mit " + s.on.join("+") } : null;
  const f = a.slice(8), on = s.on.includes(f) ? s.on.filter((x) => x !== f) : [...s.on, f].sort();
  if (on.includes("legacy") && on.includes("tls")) return { state: { on }, trap: "legacy+tls beschädigt die Zertifikate" };
  return { state: { on } };
}

export const key = (s) => s.on.join("+");
