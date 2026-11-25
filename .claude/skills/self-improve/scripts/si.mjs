#!/usr/bin/env node
// self-improve helper. Node >= 18, no dependencies.
// Usage: node si.mjs <cmd> <skillDir> [opts]
//   init     <dir>                                  create .self-improve/, hash invariant block
//   log      <dir> --outcome ok|partial|fail --task "..." [--friction "..."]...   append run, print id
//   snapshot <dir>                                  copy SKILL.md to history/v<current>.md
//   bump     <dir> --run rN --change "..."           new patch version, changelog entry (needs snapshot + friction)
//   trend    <dir>                                  score per version; exit 3 = regression -> revert
//   revert   <dir>                                  restore previous version's snapshot
//   check    <dir>                                  validate; exit 0 ok, 1 errors
// Exit 2 = bad call.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const [cmd, dirArg, ...rest] = process.argv.slice(2);
if (!cmd || !dirArg) { console.error("usage: si.mjs <init|log|snapshot|bump|trend|revert|check> <skillDir> [opts]"); process.exit(2); }
const dir = path.resolve(dirArg);
const SI = path.join(dir, ".self-improve");
const P = { skill: path.join(dir, "SKILL.md"), runs: path.join(SI, "runs.jsonl"), log: path.join(SI, "CHANGELOG.md"), hist: path.join(SI, "history"), inv: path.join(SI, "invariant.sha256"), ok: path.join(SI, "approved.sha256") };
const MAX_LINES = 200;
const SCORE = { ok: 1, partial: 0.5, fail: 0 };

const opts = {}; for (let i = 0; i < rest.length; i += 2) { const k = rest[i].replace(/^--/, ""); (opts[k] ??= []).push(rest[i + 1]); }
const one = (k) => opts[k]?.[0];
const die = (m, c = 1) => { console.error(m); process.exit(c); };
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const runs = () => read(P.runs).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const entries = () => [...read(P.log).matchAll(/^## v(\d+)\.(\d+)\.(\d+) \| (\S+) \| run:(\S+) \| (.*)$/gm)]
  .map((m) => ({ v: [+m[1], +m[2], +m[3]], ver: `${m[1]}.${m[2]}.${m[3]}`, date: m[4], run: m[5], change: m[6] }));
const current = () => entries().at(-1)?.ver ?? "0.1.0";
const invariant = (t) => t.match(/<!-- INVARIANT START -->([\s\S]*?)<!-- INVARIANT END -->/)?.[1] ?? null;
const sha = (s) => crypto.createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);
const approve = () => fs.writeFileSync(P.ok, sha(read(P.skill)) + "\n"); // current SKILL.md is the approved one

if (!fs.existsSync(P.skill)) die(`no SKILL.md in ${dir}`, 2);

switch (cmd) {
  case "init": {
    fs.mkdirSync(P.hist, { recursive: true });
    if (!fs.existsSync(P.runs)) fs.writeFileSync(P.runs, "");
    if (!fs.existsSync(P.log)) fs.writeFileSync(P.log, "# Changelog\n\nStart: v0.1.0\n");
    const inv = invariant(read(P.skill));
    if (inv && !fs.existsSync(P.inv)) fs.writeFileSync(P.inv, sha(inv) + "\n");
    if (!fs.existsSync(P.ok)) approve();
    console.log(`init ok, version ${current()}${inv ? ", invariant hashed" : ""}`);
    break;
  }
  case "log": {
    const outcome = one("outcome"); if (!(outcome in SCORE)) die("--outcome ok|partial|fail", 2);
    const task = one("task"); if (!task) die("--task required", 2);
    const id = `r${runs().length + 1}`;
    const run = { id, ts: new Date().toISOString(), version: current(), task, outcome, friction: opts.friction ?? [] };
    fs.appendFileSync(P.runs, JSON.stringify(run) + "\n");
    console.log(id);
    break;
  }
  case "snapshot": {
    fs.mkdirSync(P.hist, { recursive: true });
    const f = path.join(P.hist, `v${current()}.md`);
    fs.copyFileSync(P.skill, f); console.log(`snapshot ${path.relative(dir, f)}`);
    break;
  }
  case "bump": {
    const id = one("run"), change = one("change");
    if (!id || !change) die("--run and --change required", 2);
    const run = runs().find((r) => r.id === id); if (!run) die(`run ${id} not found`);
    if (!run.friction.length) die(`run ${id} has no friction: no evidence, no change`);
    if (!fs.existsSync(path.join(P.hist, `v${current()}.md`))) die(`snapshot v${current()} missing: run snapshot before editing`);
    const [a, b, c] = current().split(".").map(Number); const ver = `${a}.${b}.${c + 1}`;
    fs.appendFileSync(P.log, `\n## v${ver} | ${today()} | run:${id} | ${change}\n`);
    approve();
    console.log(`v${ver}`);
    break;
  }
  case "trend": {
    const by = {}; for (const r of runs()) (by[r.version] ??= []).push(SCORE[r.outcome]);
    const vers = Object.keys(by); const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    for (const v of vers) console.log(`v${v}  runs=${by[v].length}  score=${avg(by[v]).toFixed(2)}`);
    const [prev, last] = vers.slice(-2);
    if (prev && last && by[last].length >= 2 && avg(by[last]) < avg(by[prev])) { console.log(`REGRESSION v${last} < v${prev}: revert`); process.exit(3); }
    break;
  }
  case "revert": {
    const es = entries(); if (!es.length) die("nothing to revert");
    const prev = es.length > 1 ? es.at(-2).ver : "0.1.0";
    const f = path.join(P.hist, `v${prev}.md`); if (!fs.existsSync(f)) die(`snapshot v${prev} missing`);
    fs.copyFileSync(P.skill, path.join(P.hist, `v${current()}.md`));
    fs.copyFileSync(f, P.skill);
    approve();
    const [a, b, c] = current().split(".").map(Number);
    fs.appendFileSync(P.log, `\n## v${a}.${b}.${c + 1} | ${today()} | run:${runs().at(-1)?.id ?? "-"} | REVERT to v${prev} (trend regression)\n`);
    console.log(`reverted to v${prev} content as v${a}.${b}.${c + 1}`);
    break;
  }
  case "check": {
    const err = []; const t = read(P.skill);
    const fm = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) err.push("frontmatter missing");
    else { if (!/^name:\s*\S/m.test(fm[1])) err.push("frontmatter: name missing"); if (!/^description:\s*\S/m.test(fm[1])) err.push("frontmatter: description missing"); }
    const lines = t.split("\n").length; if (lines > MAX_LINES) err.push(`SKILL.md ${lines} lines > budget ${MAX_LINES}`);
    if (!fs.existsSync(SI)) err.push(".self-improve/ missing: run init");
    else if (!fs.existsSync(P.ok)) err.push("approved.sha256 missing: run init");
    else if (sha(t) !== read(P.ok).trim()) err.push("SKILL.md changed without bump (no logged evidence)");
    const inv = invariant(t);
    if (fs.existsSync(P.inv)) { if (!inv) err.push("invariant block removed"); else if (sha(inv) !== read(P.inv).trim()) err.push("invariant block changed"); }
    const rs = runs(); const es = entries(); let last = [0, 1, 0];
    for (const e of es) {
      const gt = e.v[0] - last[0] || e.v[1] - last[1] || e.v[2] - last[2];
      if (gt <= 0) err.push(`v${e.ver}: version not increasing`); last = e.v;
      const r = rs.find((x) => x.id === e.run);
      if (!e.change.startsWith("REVERT")) {
        if (!r) err.push(`v${e.ver}: run ${e.run} not in runs.jsonl`);
        else if (!r.friction.length) err.push(`v${e.ver}: run ${e.run} has no friction`);
      }
    }
    for (let i = 0; i < es.length; i++) { const pv = i ? es[i - 1].ver : "0.1.0"; if (!fs.existsSync(path.join(P.hist, `v${pv}.md`))) err.push(`v${es[i].ver}: snapshot v${pv} missing`); }
    if (err.length) { err.forEach((e) => console.error("FAIL " + e)); process.exit(1); }
    console.log(`check ok  v${current()}  runs=${rs.length}  changes=${es.length}  lines=${lines}`);
    break;
  }
  default: die(`unknown cmd ${cmd}`, 2);
}
