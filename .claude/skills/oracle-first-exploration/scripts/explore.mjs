#!/usr/bin/env node
// Generischer Zustandsgraph-Explorer (BFS & A*) mit Budget, Deduplizierung, Fallen-Bericht,
// verteiltem Zustands-Set (>16,7 Mio. Zustände), Fehler-Wiederholung und Checkpoint-Wiederaufnahme.
//
// CLI:
//   node explore.mjs <adapter.mjs> [--depth 12] [--nodes 5000] [--conc 16] [--all] [--mode bfs|astar]
//                                  [--checkpoint datei] [--checkpoint-every 60]
//                                  [--retries 2] [--backoff 200] [--max-fail 20]
//
// Bibliothek:
//   import { explore } from "./explore.mjs";
//   const r = await explore(adapter, { mode: "astar", depth: 20 });
//
// Exit 0 = Ziel gefunden, 1 = kein Ziel, 2 = falscher Aufruf / kaputter Adapter, 3 = unvollständig / Halt.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import fs from "node:fs";
import v8 from "node:v8";

async function pool(tasks, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => {
    while (i < tasks.length) { const j = i++; out[j] = await tasks[j](); }
  }));
  return out;
}

class Heap {
  constructor() { this.a = []; this.n = 0; }
  get size() { return this.a.length; }
  less(x, y) { return x.f < y.f || (x.f === y.f && x.seq < y.seq); }
  push(v) {
    v.seq = this.n++; const a = this.a; a.push(v);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

function checkAdapter(A) {
  const miss = ["initial", "actions", "step"].filter((k) => A?.[k] === undefined);
  if (miss.length) throw new Error("Adapter unvollständig, es fehlt: " + miss.join(", "));
  if (typeof A.actions !== "function" || typeof A.step !== "function") {
    throw new Error("actions und step müssen Funktionen sein");
  }
}

export async function explore(A, { depth = 12, nodes = 5000, conc = 16, all = false, mode = "bfs", log = () => {} } = {}) {
  checkAdapter(A);
  if (mode !== "bfs" && mode !== "astar") throw new Error("mode muss bfs oder astar sein");
  const key = A.key || ((s) => JSON.stringify(s));
  const h = A.heuristic || (() => 0);
  const t0 = Date.now();
  const goals = [], traps = new Map(), used = new Set(), tried = new Set();
  let calls = 0, stop = false, budgetHit = false;

  const acts = (s) => {
    const a = A.actions(s);
    if (!Array.isArray(a)) throw new Error("actions() muss ein Array liefern");
    return a;
  };
  async function tryStep(state, a, path) {
    calls++; tried.add(a);
    const r = await A.step(state, a);
    if (!r) return null;
    used.add(a);
    const p = [...path, a];
    if (r.trap) {
      const tk = a + "\u0000" + r.trap, t = traps.get(tk);
      if (t) t.n++; else traps.set(tk, { path: p, why: r.trap, n: 1 });
      return null;
    }
    const cost = r.cost === undefined ? 1 : Number(r.cost);
    if (!(cost >= 0)) throw new Error(`cost muss eine Zahl ≥ 0 sein (Aktion ${a})`);
    return { r, p, cost };
  }

  if (mode === "bfs") {
    const seen = new Map([[key(A.initial), 0]]);
    let frontier = [{ state: A.initial, path: [], g: 0 }];
    for (let d = 1; d <= depth && frontier.length && !stop; d++) {
      const jobs = frontier.flatMap(({ state, path, g }) => acts(state).map((a) => async () => {
        if (stop) return;
        const x = await tryStep(state, a, path);
        if (!x) return;
        const { r, p, cost } = x, k = key(r.state);
        if (r.goal) {
          if (stop) return;
          goals.push({ path: p, note: r.note, cost: g + cost });
          if (!all) stop = true;
          return;
        }
        if (seen.has(k)) return;
        seen.set(k, g + cost);
        if (r.note) log(`d${d}  ${p.join(" > ")}\n     ${String(r.note).slice(0, 240)}`);
        return { state: r.state, path: p, g: g + cost };
      }));
      frontier = (await pool(jobs, conc)).filter(Boolean);
      if (seen.size >= nodes && frontier.length) { budgetHit = true; break; }
    }
    return finish(seen.size);
  }

  const k0 = key(A.initial);
  const best = new Map([[k0, 0]]);
  const open = new Heap();
  open.push({ state: A.initial, path: [], g: 0, f: h(A.initial), k: k0 });
  let expanded = 0;
  while (open.size && !stop) {
    const batch = [];
    while (open.size && batch.length < conc) {
      const n = open.pop();
      if (n.goal) {
        if (batch.length) { open.push(n); break; }
        goals.push({ path: n.path, note: n.note, cost: n.g });
        if (!all) stop = true;
        break;
      }
      if (n.g > (best.get(n.k) ?? Infinity)) continue;
      if (n.path.length >= depth) continue;
      batch.push(n);
    }
    if (stop || !batch.length) continue;
    if (expanded + batch.length > nodes) { budgetHit = true; break; }
    expanded += batch.length;
    const jobs = batch.flatMap(({ state, path, g }) => acts(state).map((a) => async () => {
      const x = await tryStep(state, a, path);
      if (!x) return;
      const { r, p, cost } = x, ng = g + cost;
      if (r.goal) { open.push({ path: p, note: r.note, g: ng, f: ng, goal: true }); return; }
      const k = key(r.state);
      if (ng >= (best.get(k) ?? Infinity)) return;
      best.set(k, ng);
      if (r.note) log(`g${ng}  ${p.join(" > ")}\n     ${String(r.note).slice(0, 240)}`);
      open.push({ state: r.state, path: p, g: ng, f: ng + h(r.state), k });
    }));
    await pool(jobs, conc);
  }
  return finish(best.size);

  function finish(states) {
    return {
      goals, traps: [...traps.values()], dead: [...tried].filter((a) => !used.has(a)),
      states, calls, ms: Date.now() - t0, budgetHit,
    };
  }
}

async function runCli() {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : argv.splice(i, 2)[1]; };
  const flag = (n) => { const i = argv.indexOf("--" + n); return i < 0 ? false : (argv.splice(i, 1), true); };
  const DEPTH = +opt("depth", 12), NODES = +opt("nodes", 5000), CONC = +opt("conc", 16), ALL = flag("all");
  const MODE = opt("mode", "bfs");
  const CKPT = opt("checkpoint", null), EVERY = +opt("checkpoint-every", 60) * 1000;
  const RETRIES = +opt("retries", 2), BACKOFF = +opt("backoff", 200), MAXFAIL = +opt("max-fail", 20);

  if (!argv[0] || argv.length > 1 || ![DEPTH, NODES, CONC].every((x) => x > 0) || !["bfs", "astar"].includes(MODE)) {
    console.error("Nutzung: node explore.mjs <adapter.mjs> [--depth N] [--nodes N] [--conc N] [--all] [--mode bfs|astar] [--checkpoint datei]");
    process.exit(2);
  }

  const adapterPath = resolve(argv[0]);
  let A;
  try { A = await import(pathToFileURL(adapterPath).href); checkAdapter(A); }
  catch (e) { console.error("Fehler: " + e.message); process.exit(2); }

  if (MODE === "astar") {
    let r;
    try { r = await explore(A, { depth: DEPTH, nodes: NODES, conc: CONC, all: ALL, mode: "astar", log: console.log }); }
    catch (e) { console.error("Fehler: " + e.message); process.exit(2); }
    console.log("\n== Ergebnis (astar)");
    for (const g of r.goals) console.log("ZIEL  " + g.path.join(" > ") + `  [kosten ${g.cost}]` + (g.note ? "\n      " + g.note : ""));
    if (!r.goals.length) console.log("kein Ziel gefunden (Tiefe " + DEPTH + "). Kandidaten erweitern oder Tiefe erhöhen.");
    for (const t of r.traps) console.log("FALLE " + t.path.join(" > ") + "  –  " + t.why + (t.n > 1 ? `  (${t.n}× erreicht)` : ""));
    if (r.dead.length) console.log("nie wirksam (Kandidaten streichen?): " + r.dead.join(", "));
    if (r.budgetHit) console.log(`! Knotenbudget ${NODES} erreicht – Suche abgebrochen.`);
    console.log(`zustände=${r.states} aufrufe=${r.calls} zeit=${r.ms}ms`);
    process.exit(r.goals.length ? 0 : 1);
  }

  const key = A.key || ((s) => JSON.stringify(s));
  const ADAPTER_ID = createHash("sha256").update(fs.readFileSync(adapterPath)).digest("hex").slice(0, 16);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pathOf = (n) => { const p = []; for (; n; n = n.up) p.push(n.a); return p.reverse(); };

  const HEAP_LIMIT = v8.getHeapStatistics().heap_size_limit;
  const YOUNG = 48 << 20, OLD_LIMIT = Math.max(HEAP_LIMIT - YOUNG, 16 << 20);
  const HEAP_RESERVE = YOUNG + Math.max(0.15 * OLD_LIMIT, 12 << 20);
  const SHARD = +process.env.EXPLORE_SHARD || Math.min(1 << 23, Math.max(1 << 14, Math.floor(HEAP_LIMIT / 512)));
  const seen = {
    sets: [new Set()], size: 0,
    has(k) { for (const s of this.sets) if (s.has(k)) return true; return false; },
    add(k) { let s = this.sets[this.sets.length - 1]; if (s.size >= SHARD) this.sets.push(s = new Set()); s.add(k); this.size++; },
  };

  const t0 = Date.now();
  let depth = 1, calls = 0, seq = 0, exhausted = false, gaps = false;
  let level = [{ state: A.initial, node: null }];
  let next = [], failed = [];
  const goals = [], traps = new Map(), errors = new Map(), used = new Set(), tried = new Set();
  seen.add(key(A.initial));

  let stop = false, halt = null, pause = false;
  let failRun = 0, needSort = false, lastSeq = -1, lastGuard = 0, sinceGuard = 0, nextCkptAt = Date.now() + EVERY;
  let li = 0, cur = null, ai = 0;

  function nextJob() {
    for (;;) {
      if (!cur) {
        if (li >= level.length) return null;
        const e = level[li];
        cur = { e, acts: e.acts || A.actions(e.state) };
        ai = 0;
      }
      if (ai < cur.acts.length) return { state: cur.e.state, node: cur.e.node, a: cur.acts[ai++], seq: seq++ };
      level[li++] = null; cur = null;
    }
  }
  function* pending() {
    if (cur && ai < cur.acts.length) yield { state: cur.e.state, node: cur.e.node, acts: cur.acts.slice(ai) };
    for (let i = li + (cur ? 1 : 0); i < level.length; i++) yield level[i];
  }
  function guard() {
    const now = Date.now();
    if (now - lastGuard < Math.min(250, EVERY) && ++sinceGuard < 2048) return false;
    const tick = now - lastGuard >= Math.min(250, EVERY);
    lastGuard = now; sinceGuard = 0;
    if (CKPT && now >= nextCkptAt) pause = true;
    const hs = v8.getHeapStatistics();
    if (hs.total_available_size < HEAP_RESERVE) {
      halt = `Speicher fast voll (${hs.used_heap_size >> 20} MB belegt, ${OLD_LIMIT >> 20} MB nutzbar). Mit node --max-old-space-size=<MB> und mehr Speicher fortsetzen`;
    }
    return tick;
  }
  function fail(j, e) {
    const msg = String(e?.message ?? e).split("\n")[0].slice(0, 200);
    failed.push({ state: j.state, node: j.node, a: j.a });
    gaps = true;
    const k = j.a + "\u0000" + msg, x = errors.get(k);
    if (x) x.n++; else errors.set(k, { path: pathOf({ up: j.node, a: j.a }), why: msg, n: 1 });
    if (++failRun >= MAXFAIL && !halt) halt = `System antwortet nicht (${failRun} Fehler in Folge)`;
  }
  async function runJob(j) {
    calls++; tried.add(j.a);
    let r;
    for (let t = 0; ; t++) {
      try { r = await A.step(j.state, j.a); break; }
      catch (e) {
        if (t >= RETRIES || halt) return fail(j, e);
        await sleep(BACKOFF * 2 ** t);
      }
    }
    failRun = 0;
    if (!r) return;
    used.add(j.a);
    const n = { up: j.node, a: j.a }, k = key(r.state);
    if (r.trap) {
      const tk = j.a + "\u0000" + r.trap, t = traps.get(tk);
      if (t) t.n++; else traps.set(tk, { path: pathOf(n), why: r.trap, n: 1 });
      return;
    }
    if (r.goal) { goals.push({ path: pathOf(n), note: r.note }); if (!ALL) stop = true; return; }
    if (seen.has(k)) return;
    seen.add(k);
    if (r.note) console.log(`d${depth}  ${pathOf(n).join(" > ")}\n     ${String(r.note).slice(0, 240)}`);
    if (j.seq < lastSeq) needSort = true; else lastSeq = j.seq;
    next.push({ state: r.state, node: n, seq: j.seq });
  }
  async function drain(source) {
    const worker = async () => {
      for (;;) {
        if (stop || halt || pause) return;
        let j = null;
        try {
          if (guard()) await new Promise(setImmediate);
          if (stop || halt || pause || !(j = source())) return;
          await runJob(j);
        } catch (e) {
          if (j) fail(j, e);
          if (!halt) halt = "Fehler im Adapter: " + String(e?.message ?? e).split("\n")[0].slice(0, 200);
          return;
        }
      }
    };
    await Promise.all(Array.from({ length: CONC }, worker));
  }

  function saveCheckpoint() {
    const started = Date.now(), tmp = CKPT + ".tmp", fd = fs.openSync(tmp, "w"), sha = createHash("sha256");
    let buf = [], len = 0, lines = 0;
    const flush = () => { if (buf.length) fs.writeSync(fd, buf.join("")); buf = []; len = 0; };
    const put = (tag, v) => { const s = JSON.stringify([tag, v]) + "\n"; sha.update(s); buf.push(s); lines++; if ((len += s.length) > 1 << 20) flush(); };
    const chunks = (tag, it, size) => { let c = []; for (const x of it) { c.push(x); if (c.length >= size) { put(tag, c); c = []; } } if (c.length) put(tag, c); };

    put("H", { v: 1, adapter: ADAPTER_ID, depth, calls, seq, exhausted, gaps, used: [...used], tried: [...tried] });
    chunks("K", (function* () { for (const s of seen.sets) yield* s; })(), 5000);
    const ids = new Map(); let nid = 0, nodes = [];
    const idOf = (n) => {
      const chain = [];
      for (; n && !ids.has(n); n = n.up) chain.push(n);
      let up = n ? ids.get(n) : 0;
      while (chain.length) { const x = chain.pop(); ids.set(x, ++nid); nodes.push([nid, up, x.a]); up = nid; }
      if (nodes.length >= 5000) { put("N", nodes); nodes = []; }
      return up;
    };
    const entries = (tag, it, row) => {
      let c = [];
      const out = () => { if (nodes.length) { put("N", nodes); nodes = []; } if (c.length) put(tag, c); c = []; };
      for (const e of it) { c.push(row(e, idOf(e.node))); if (c.length >= 2000) out(); }
      out();
    };
    entries("L", pending(), (e, id) => [e.state, id, e.acts || 0]);
    entries("X", next, (e, id) => [e.state, id, e.seq]);
    entries("F", failed, (e, id) => [e.state, id, e.a]);
    put("G", goals); put("T", [...traps]); put("E", [...errors]);
    flush();
    fs.writeSync(fd, JSON.stringify(["Z", { lines, sha: sha.digest("hex") }]) + "\n");
    fs.fsyncSync(fd); fs.closeSync(fd);
    if (fs.existsSync(CKPT)) fs.renameSync(CKPT, CKPT + ".bak");
    fs.renameSync(tmp, CKPT);
    nextCkptAt = Date.now() + Math.max(EVERY, 10 * (Date.now() - started));
  }

  function* readLines(file) {
    const fd = fs.openSync(file, "r"), chunk = Buffer.alloc(1 << 20), dec = new StringDecoder("utf8");
    let rest = "";
    try {
      for (let n; (n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0;) {
        const parts = (rest + dec.write(chunk.subarray(0, n))).split("\n");
        rest = parts.pop();
        yield* parts;
      }
      if (rest) yield rest;
    } finally { fs.closeSync(fd); }
  }

  function loadCheckpoint(file) {
    const sha = createHash("sha256"), c = { keys: [], nodes: [null], L: [], X: [], F: [], G: [], T: [], E: [], H: null };
    let lines = 0, end = null;
    for (const line of readLines(file)) {
      if (end) throw new Error("Daten nach der Schlusszeile");
      let tag, v;
      try { [tag, v] = JSON.parse(line); } catch { throw new Error("Zeile " + (lines + 1) + " ist kein JSON"); }
      if (tag === "Z") { end = v; continue; }
      sha.update(line + "\n"); lines++;
      if (tag === "H") c.H = v;
      else if (tag === "K") c.keys.push(v);
      else if (tag === "N") for (const [id, up, a] of v) c.nodes[id] = { up: c.nodes[up] || null, a };
      else if (tag === "L") for (const [state, id, acts] of v) c.L.push(acts ? { state, node: c.nodes[id] || null, acts } : { state, node: c.nodes[id] || null });
      else if (tag === "X") for (const [state, id, s] of v) c.X.push({ state, node: c.nodes[id] || null, seq: s });
      else if (tag === "F") for (const [state, id, a] of v) c.F.push({ state, node: c.nodes[id] || null, a });
      else if (tag === "G" || tag === "T" || tag === "E") c[tag] = v;
    }
    if (!end) throw new Error("Schlusszeile fehlt – Datei unvollständig");
    if (end.lines !== lines || end.sha !== sha.digest("hex")) throw new Error("Prüfsumme stimmt nicht");
    if (!c.H || c.H.v !== 1) throw new Error("unbekanntes Format");
    if (c.H.adapter !== ADAPTER_ID) throw Object.assign(new Error("gehört zu einem anderen oder geänderten Adapter"), { fatal: true });
    return c;
  }

  function restore(c) {
    ({ depth, calls, seq, exhausted, gaps } = c.H);
    seen.sets = [new Set()]; seen.size = 0;
    for (const ks of c.keys) for (const k of ks) seen.add(k);
    level = c.L; next = c.X; failed = c.F; li = 0; cur = null;
    lastSeq = next.length ? next[next.length - 1].seq : -1;
    goals.push(...c.G);
    for (const [k, v] of c.T) traps.set(k, v);
    for (const [k, v] of c.E) errors.set(k, v);
    for (const a of c.H.used) used.add(a);
    for (const a of c.H.tried) tried.add(a);
  }

  if (CKPT) {
    let loaded = false;
    for (const f of [CKPT, CKPT + ".bak"]) {
      if (!fs.existsSync(f)) continue;
      try {
        restore(loadCheckpoint(f));
        console.log(`~ Stand geladen aus ${f}: tiefe=${depth} zustände=${seen.size} aufrufe=${calls}` + (failed.length ? ` nachzuholen=${failed.length}` : ""));
        loaded = true;
        break;
      } catch (e) {
        if (e.fatal) { console.error(`Checkpoint ${f} ${e.message}. Datei löschen oder anderen Pfad angeben.`); process.exit(2); }
        console.log(`! Checkpoint ${f} unbrauchbar (${e.message}).`);
      }
    }
    if (!loaded && (fs.existsSync(CKPT) || fs.existsSync(CKPT + ".bak"))) console.log("! Keine brauchbare Sicherung – Suche beginnt von vorn.");
  }
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (halt) process.exit(130); halt = "Signal " + sig; });

  const done = () => goals.length && !ALL;
  try {
    if (failed.length && !done()) {
      const retry = failed; failed = []; errors.clear();
      let i = 0;
      do { pause = false; await drain(() => (i < retry.length ? { ...retry[i++], seq: seq++ } : null)); } while (pause && !halt && !stop);
      failed.push(...retry.slice(i));
      if (next.length) exhausted = false;
    }
    while (!done() && !halt && !exhausted && depth <= DEPTH) {
      await drain(nextJob);
      if (pause && !stop && !halt) { pause = false; saveCheckpoint(); continue; }
      if (stop || halt) break;
      if (needSort) { next.sort((a, b) => a.seq - b.seq); needSort = false; }
      level = next; next = []; li = 0; cur = null; depth++; seq = 0; lastSeq = -1;
      if (!level.length) { exhausted = true; break; }
      if (seen.size >= NODES) { console.log(`! Knotenbudget ${NODES} erreicht – Suche abgebrochen.`); break; }
    }
  } catch (e) {
    halt = "interner Fehler: " + String(e?.message ?? e).split("\n")[0];
  }

  let saved = false;
  if (CKPT) { try { saveCheckpoint(); saved = true; } catch (e) { console.log("! Sichern fehlgeschlagen: " + e.message); } }

  console.log("\n== Ergebnis");
  for (const g of ALL ? goals : goals.slice(0, 1)) console.log("ZIEL  " + g.path.join(" > ") + (g.note ? "\n      " + g.note : ""));
  if (goals.length && gaps) console.log("      Hinweis: Es gab fehlgeschlagene Schritte. Der Pfad stimmt, ist aber womöglich nicht der kürzeste.");
  if (!goals.length) console.log(exhausted && !failed.length ? "kein Ziel gefunden: alle erreichbaren Zustände durchsucht." : halt || failed.length ? "kein Ziel gefunden, Suche unvollständig." : "kein Ziel gefunden (Tiefe " + DEPTH + "). Kandidaten erweitern oder Tiefe erhöhen.");
  for (const t of traps.values()) console.log("FALLE " + t.path.join(" > ") + "  –  " + t.why + (t.n > 1 ? `  (${t.n}× erreicht)` : ""));
  for (const e of errors.values()) console.log("FEHLER " + e.path.join(" > ") + "  –  " + e.why + (e.n > 1 ? `  (${e.n}×)` : ""));
  const dead = [...tried].filter((a) => !used.has(a));
  if (dead.length) console.log("nie wirksam (Kandidaten streichen?): " + dead.join(", "));
  if (halt) console.log("ABBRUCH: " + halt + ".");
  if (failed.length) console.log(`unvollständig: ${failed.length} Schritt(e) fehlgeschlagen.` + (CKPT ? "" : " Mit --checkpoint <datei> lassen sie sich im nächsten Lauf nachholen."));
  if (saved && !done() && (halt || failed.length || !exhausted)) console.log(`Stand gesichert in ${CKPT}. Derselbe Aufruf setzt dort fort.`);
  console.log(`zustände=${seen.size} aufrufe=${calls} zeit=${Date.now() - t0}ms`);
  process.exit(goals.length ? 0 : halt || failed.length ? 3 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runCli();
