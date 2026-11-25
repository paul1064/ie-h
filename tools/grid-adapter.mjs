// Benchmark-Adapter: leeres W×W-Gitter, Ziel in der gegenüberliegenden Ecke.
// Der Explorer muss dafür fast alle W² Zustände besuchen. Größe über die Umgebungsvariable W.
const W = +process.env.W || 100;
export const initial = { x: 0, y: 0 };
export const actions = () => ["r", "d", "l", "u"];
export async function step(s, a) {
  const x = s.x + (a === "r") - (a === "l"), y = s.y + (a === "d") - (a === "u");
  if (x < 0 || y < 0 || x >= W || y >= W) return null;
  return { state: { x, y }, goal: x === W - 1 && y === W - 1 };
}
export const key = (s) => s.x * W + s.y;
