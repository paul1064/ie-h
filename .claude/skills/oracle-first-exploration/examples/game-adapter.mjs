// Beispiel Spiel: Weg durch ein Labyrinth mit Sumpf (teuer) und Fallgruben.
//   node ../scripts/explore.mjs game-adapter.mjs --mode astar --depth 20
// Zeigt den A*-Modus: Schritte haben Kosten (Sumpf = 5), die Manhattan-Distanz als
// Heuristik hält die Suche auch auf großen Karten klein. BFS findet den kürzesten Weg
// nach Schritten (9, quer durch den Sumpf), A* den günstigsten nach Kosten (15 statt 21).
const MAP = [
  "S..~~~...G",
  ".######.#.",
  "...#O#....",
  "..........",
];
const W = MAP[0].length, H = MAP.length;
const find = (ch) => { for (let y = 0; y < H; y++) { const x = MAP[y].indexOf(ch); if (x >= 0) return { x, y }; } };
const G = find("G"), DIRS = { n: [0, -1], s: [0, 1], w: [-1, 0], o: [1, 0] };

export const initial = find("S");
export const actions = () => Object.keys(DIRS);
export const key = (p) => p.x + "," + p.y;
export const heuristic = (p) => Math.abs(p.x - G.x) + Math.abs(p.y - G.y); // zulässig: jeder Schritt kostet ≥ 1

export async function step(p, d) {
  const x = p.x + DIRS[d][0], y = p.y + DIRS[d][1];
  const c = MAP[y]?.[x];
  if (c === undefined || c === "#") return null;                    // Wand / Rand
  if (c === "O") return { state: { x, y }, trap: "Fallgrube" };
  if (c === "G") return { state: { x, y }, goal: true, note: "Ausgang erreicht", cost: 1 };
  return { state: { x, y }, cost: c === "~" ? 5 : 1 };
}
