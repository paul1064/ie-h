// Zahlenschloss mit drei Rädern (0–9). Das Orakel verrät nur „offen“ oder nichts.
// Zeigt: 1000 Kombinationen sind per Hand zu viel, per BFS ein Wimpernschlag.
//   node scripts/explore.mjs examples/zahlenschloss.mjs
export const initial = { r: [0, 0, 0] };
const CODE = "471";

export function actions() {
  return ["rad1+", "rad1-", "rad2+", "rad2-", "rad3+", "rad3-", "ziehen"];
}

export async function step(s, a) {
  if (a === "ziehen") return s.r.join("") === CODE ? { state: s, goal: true, note: "Bügel springt auf" } : null;
  const i = +a[3] - 1, r = [...s.r];
  r[i] = (r[i] + (a[4] === "+" ? 1 : 9)) % 10;
  return { state: { r } };
}

export const key = (s) => s.r.join("");
