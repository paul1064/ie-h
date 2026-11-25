// Labyrinth aus einer Textkarte: S Start, Z Ziel, # Wand, G Grube (Falle).
// Zeigt: Fallen explizit markieren, Wände als „keine Wirkung“ (null) zurückgeben.
//   node scripts/explore.mjs examples/labyrinth.mjs
const MAP = [
  "S.#....",
  ".##.##.",
  "...G...",
  ".#####.",
  "......Z",
];
const find = (c) => { for (let y = 0; y < MAP.length; y++) { const x = MAP[y].indexOf(c); if (x >= 0) return { x, y }; } };
const DIR = { nord: [0, -1], süd: [0, 1], west: [-1, 0], ost: [1, 0] };
export const initial = find("S");

export function actions() {
  return Object.keys(DIR);
}

export async function step(s, a) {
  const [dx, dy] = DIR[a], x = s.x + dx, y = s.y + dy, c = MAP[y]?.[x];
  if (c === undefined || c === "#") return null;
  if (c === "G") return { state: { x, y }, trap: "Grube – kein Weg heraus" };
  return { state: { x, y }, goal: c === "Z" };
}

export const key = (s) => s.x + "," + s.y;
