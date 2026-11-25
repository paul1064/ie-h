// Simulierte API mit Seiten-Cursor. Gesucht: der Datensatz mit status "offen".
// Zeigt: frühe Entscheidungen gehören in den Zustand (der Filter gilt für alle Folgeseiten),
// und ein Cursor, der auf sich selbst zeigt, ist eine Falle statt einer Endlosschleife.
//   node scripts/explore.mjs examples/api-blaettern.mjs
const PAGES = {
  "alle:1": { next: "alle:2", items: ["zu", "zu"] },
  "alle:2": { next: "alle:2", items: ["zu"] },           // defekter Cursor: zeigt auf sich selbst
  "archiv:1": { next: "archiv:2", items: ["zu"] },
  "archiv:2": { next: "archiv:3", items: ["zu", "zu"] },
  "archiv:3": { next: null, items: ["zu", "offen"] },
};
export const initial = { filter: null, page: null };

export function actions(s) {
  return s.filter ? ["weiter", "lesen"] : ["filter=alle", "filter=archiv"];
}

export async function step(s, a) {
  if (a.startsWith("filter=")) { const filter = a.slice(7); return { state: { filter, page: filter + ":1" } }; }
  const p = PAGES[s.page];
  if (a === "lesen") return p.items.includes("offen") ? { state: s, goal: true, note: "Datensatz 'offen' auf " + s.page } : null;
  if (!p.next) return null;
  if (p.next === s.page) return { state: s, trap: "Cursor zeigt auf dieselbe Seite" };
  return { state: { ...s, page: p.next } };
}

export const key = (s) => s.page ?? "start";
