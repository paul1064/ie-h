// Spielzeug-Adapter zum Ausprobieren von explore.mjs:
//   node scripts/explore.mjs examples/toy-adapter.mjs   (aus dem Skill-Ordner)
// Ein Tresor mit Kombinationsschloss: nur eine Reihenfolge öffnet ihn, eine Seitentür
// führt in eine Endlosschleife (Falle), ein Wort ist ein Köder (plausibel, aber wertlos).
export const initial = { pos: "start", progress: 0 };
const SECRET = ["links", "links", "rechts", "links"];

export function actions() {
  return ["links", "rechts", "warte", "seitentür", "öffne"];
}

export async function step(s, a) {
  await new Promise((r) => setTimeout(r, 5)); // simuliert ein langsames Echtsystem
  if (a === "warte") return null;                                   // ohne Wirkung
  if (a === "seitentür") return { state: { pos: "flur", progress: 0 }, trap: "Schleife ohne Ende, keine Belohnung" };
  if (a === "öffne") {
    if (s.progress === SECRET.length) return { state: s, goal: true, note: "Tresor offen" };
    return { state: { ...s, pos: "lobby" }, note: "Die Tür klickt. Hinter ihr: eine Lobby. (Köder: sieht nach Fortschritt aus)" };
  }
  const ok = SECRET[s.progress] === a;
  return { state: { pos: "start", progress: ok ? s.progress + 1 : 0 }, note: ok ? "Klick." : undefined };
}

export const key = (s) => s.pos + ":" + s.progress;
