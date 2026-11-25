#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync, mkdtempSync, existsSync, truncateSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { explore } from "./explore.mjs";

const CLI = fileURLToPath(new URL("./explore.mjs", import.meta.url));
const EX = (f) => fileURLToPath(new URL("../examples/" + f, import.meta.url));
const GRID = fileURLToPath(new URL("../../../../tools/grid-adapter.mjs", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "explore-test-"));
const file = (name) => join(tmp, name);
const adapter = (name, src) => { const p = file(name + ".mjs"); writeFileSync(p, src); return p; };
const run = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const goalLine = (out) => out.split("\n").find((l) => l.startsWith("ZIEL  "))?.slice(6);
const statVal = (out, name) => +new RegExp(name + "=(\\d+)").exec(out.split("\n").filter((l) => l.startsWith("zustände=")).pop())[1];

const counter = (target, extra = {}) => ({
  initial: 1,
  actions: () => ["+1", "*2"],
  step: async (n, a) => { const m = a === "+1" ? n + 1 : n * 2; return m > target ? null : { state: m, goal: m === target }; },
  ...extra,
});

for (const mode of ["bfs", "astar"]) {
  test(`${mode}: findet kürzesten Pfad (1 -> 10 in 4 Schritten)`, async () => {
    const r = await explore(counter(10), { mode });
    assert.equal(r.goals[0].path.length, 4);
  });

  test(`${mode}: Zyklen terminieren und tote Aktionen werden erkannt`, async () => {
    const ring = { initial: 0, actions: () => ["weiter", "tot"], step: async (s, a) => (a === "tot" ? null : { state: (s + 1) % 5 }) };
    const r = await explore(ring, { mode, depth: 200 });
    assert.equal(r.goals.length, 0);
    assert.equal(r.states, 5);
    assert.deepEqual(r.dead, ["tot"]);
  });

  test(`${mode}: Fallen werden einmal gemeldet und gezählt`, async () => {
    const A = {
      initial: 0, actions: () => ["a", "loch"],
      step: async (s, a) => (a === "loch" ? { state: -1, trap: "Loch" } : s < 3 ? { state: s + 1 } : null),
    };
    const r = await explore(A, { mode });
    assert.equal(r.traps.length, 1);
    assert.equal(r.traps[0].n, 4);
  });

  test(`${mode}: Knotenbudget greift`, async () => {
    const inf = { initial: 0, actions: () => ["a", "b"], step: async (s, a) => ({ state: s * 2 + (a === "a" ? 1 : 2) }) };
    const r = await explore(inf, { mode, nodes: 40, depth: 50 });
    assert.equal(r.budgetHit, true);
  });
}

test("astar: günstigster statt kürzester Pfad + Heuristik spart Aufrufe", async () => {
  const A = {
    initial: "S",
    actions: (s) => ({ S: ["direkt", "u1"], U1: ["u2"], U2: ["u3"] }[s] || []),
    step: async (s, a) => ({ direkt: { state: "G", goal: true, cost: 10 }, u1: { state: "U1" }, u2: { state: "U2" }, u3: { state: "G", goal: true } }[a]),
  };
  assert.equal((await explore(A, { mode: "bfs" })).goals[0].path.join(), "direkt");
  const r = await explore(A, { mode: "astar" });
  assert.equal(r.goals[0].path.join(), "u1,u2,u3");
  assert.equal(r.goals[0].cost, 3);

  const game = await import(EX("game-adapter.mjs"));
  const withH = await explore(game, { mode: "astar", depth: 30 });
  const { heuristic, ...noH } = game;
  const without = await explore(noH, { mode: "astar", depth: 30 });
  assert.equal(withH.goals[0].cost, 15);
  assert.ok(withH.calls <= without.calls);
});

test("alle Adapter-Beispiele finden ihr Ziel", () => {
  for (const f of ["toy-adapter.mjs", "labyrinth.mjs", "zahlenschloss.mjs", "api-blaettern.mjs", "config-schalter.mjs", "api-adapter.mjs", "config-adapter.mjs"]) {
    assert.equal(run([EX(f)]).status, 0, f);
  }
  assert.equal(run([EX("game-adapter.mjs"), "--mode", "astar", "--depth", "30"]).status, 0);
});

test("verteiltes Zustands-Set (Sharding) liefert identisches Ergebnis", () => {
  const one = run([EX("zahlenschloss.mjs"), "--all"]);
  const many = run([EX("zahlenschloss.mjs"), "--all"], { EXPLORE_SHARD: "7" });
  const strip = (o) => o.replace(/zeit=\d+ms/, "");
  assert.equal(many.status, 0);
  assert.equal(strip(many.stdout), strip(one.stdout));
});

test("wackeliger Schritt heilt per Retry; Checkpoint (.bak & Prüfsumme) stellt wieder her", async () => {
  const flaky = adapter("wackelig", `
    const tries = new Map();
    export const initial = { n: 0 };
    export const actions = () => ["a"];
    export async function step(s, a) {
      const k = s.n + a, c = (tries.get(k) || 0) + 1;
      tries.set(k, c);
      if (c <= 2) throw new Error("Timeout");
      return { state: { n: s.n + 1 }, goal: s.n === 4 };
    }`);
  const rf = run([flaky, "--retries", "2", "--backoff", "1"]);
  assert.equal(rf.status, 0);
  assert.equal(goalLine(rf.stdout), "a > a > a > a > a");

  const ck = file("tiefe.ck"), lab = EX("labyrinth.mjs");
  const whole = run([lab]);
  assert.equal(run([lab, "--depth", "3", "--checkpoint", ck]).status, 1);
  const deep = run([lab, "--checkpoint", ck]);
  assert.equal(deep.status, 0);
  assert.equal(goalLine(deep.stdout), goalLine(whole.stdout));
  assert.equal(statVal(deep.stdout, "aufrufe"), statVal(whole.stdout, "aufrufe"));

  // Beschädigte Sicherung fällt auf .bak zurück
  const ckBak = file("kaputt.ck");
  const slow = adapter("slow", `
    export const initial = { r: [0, 0] };
    export const actions = () => ["a+", "b+", "zieh"];
    export async function step(s, x) {
      await new Promise((r) => setTimeout(r, 4));
      if (x === "zieh") return s.r.join("") === "44" ? { state: s, goal: true } : null;
      const r = [...s.r], i = x[0] === "a" ? 0 : 1;
      r[i] = (r[i] + 1) % 10;
      return { state: { r } };
    }
    export const key = (s) => s.r.join("");`);
  await new Promise((done) => {
    const p = spawn(process.execPath, [CLI, slow, "--conc", "1", "--depth", "20", "--checkpoint", ckBak, "--checkpoint-every", "0.04"]);
    const t = setInterval(() => { if (existsSync(ckBak + ".bak")) { clearInterval(t); p.kill("SIGINT"); } }, 10);
    p.on("close", () => { clearInterval(t); done(); });
  });
  truncateSync(ckBak, Math.floor(statSync(ckBak).size / 2));
  const rec = run([slow, "--conc", "1", "--depth", "20", "--checkpoint", ckBak]);
  assert.equal(rec.status, 0, rec.stdout);
  assert.match(rec.stdout, /~ Stand geladen aus .*\.bak/);

  // Fremder Adapter wird abgelehnt (Exit 2)
  assert.equal(run([EX("zahlenschloss.mjs"), "--checkpoint", ck]).status, 2);
});

test("Speicherwächter sichert vor Heap-Überlauf und setzt mit mehr Speicher fort", () => {
  const ck = file("heap.ck"), args = [GRID, "--depth", "100000", "--nodes", "100000000", "--checkpoint", ck];
  const small = spawnSync(process.execPath, ["--max-old-space-size=40", CLI, ...args], { encoding: "utf8", env: { ...process.env, W: "700" } });
  assert.equal(small.status, 3);
  assert.match(small.stdout, /ABBRUCH: Speicher fast voll/);
  const big = run(args, { W: "700" });
  assert.equal(big.status, 0);
  assert.equal(statVal(big.stdout, "zustände"), 489999);
});
