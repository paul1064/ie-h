#!/usr/bin/env node
// Misst den Explorer an einer Größenreihe (Standard: 5k, 50k, 500k Zustände).
//   node tools/bench.mjs [W ...]        z. B. node tools/bench.mjs 70 220 700 2214
// Gibt Beobachtungen aus (Zustände, Zeit, Zustände/s, Faktor zur Vorstufe), kein Urteil.
// Wächst die Zeit deutlich stärker als die Zustände, steckt ein Engpass in der Stufe.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
let prev;
for (const W of sizes.length ? sizes : [70, 220, 700]) {
  const r = spawnSync(process.execPath, [here("../.claude/skills/oracle-first-exploration/scripts/explore.mjs"), here("grid-adapter.mjs"), "--depth", "1000000", "--nodes", "1000000000"],
    { env: { ...process.env, W: String(W) }, encoding: "utf8", maxBuffer: 1 << 30 });
  const m = /zustände=(\d+) aufrufe=(\d+) zeit=(\d+)ms/.exec(r.stdout || "");
  if (r.status !== 0 || !m) {
    const why = (r.stderr || "").split("\n").find((l) => /Error|FATAL/.test(l)) || "";
    console.log(`W=${W}  zustände≈${W * W}  abgebrochen (exit ${r.status ?? r.signal}) ${why.trim().slice(0, 120)}`); process.exitCode = 1; continue;
  }
  const n = +m[1], ms = Math.max(+m[3], 1);
  const rel = prev ? `  zustände ×${(n / prev.n).toFixed(1)}, zeit ×${(ms / prev.ms).toFixed(1)}` : "";
  console.log(`W=${W}  zustände=${n}  zeit=${ms}ms  ${Math.round(n / ms * 1000)}/s${rel}`);
  prev = { n, ms };
}
