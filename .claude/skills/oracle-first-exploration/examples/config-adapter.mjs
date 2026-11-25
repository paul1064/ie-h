// Beispiel Config: die kleinste Menge an Schaltern finden, mit der ein Build grün wird.
//   node ../scripts/explore.mjs config-adapter.mjs
// Das Orakel ist die Validierungsregel des Builds (in echt: aus dem Schema/Linter lesen).
// Eine Aktion schaltet genau einen Schalter um. Fallen: Kombinationen, die das Schema ablehnt.

const FLAGS = ["ssr", "cache", "edge", "minify", "sourcemaps", "legacy"];

// Nachgebaute Build-Regeln: liefert Fehlertext oder null (= grün).
function validate(c) {
  if (c.edge && c.legacy) return "SCHEMA: edge und legacy schließen sich aus";
  if (c.sourcemaps && !c.minify) return "sourcemaps brauchen minify";
  if (!c.ssr) return "Seite braucht ssr";
  if (c.ssr && !c.cache) return "ssr ohne cache ist zu langsam";
  if (!c.minify) return "Bundle zu groß";
  return null;
}

export const initial = Object.fromEntries(FLAGS.map((f) => [f, false]));
export const actions = () => FLAGS.map((f) => "toggle " + f);
export const key = (c) => FLAGS.map((f) => (c[f] ? 1 : 0)).join("");

export async function step(c, a) {
  const f = a.slice(7), n = { ...c, [f]: !c[f] };
  const err = validate(n);
  if (err && err.startsWith("SCHEMA")) return { state: n, trap: err };
  if (!err) return { state: n, goal: true, note: "Build grün: " + FLAGS.filter((x) => n[x]).join(", ") };
  return { state: n };
}
