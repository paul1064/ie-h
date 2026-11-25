#!/usr/bin/env node
// Station 3 „Vor fertig“ als Skript: prüft ein hartes Erfolgssignal statt „klingt richtig“.
//
//   node verify.mjs [--cmd "npm test"] [--exit 0] [--stdout REGEX] [--not-stdout REGEX]
//                   [--file PFAD]... [--git-clean | --git-allow GLOB...] [--timeout 120]
//
//   --cmd         Befehl ausführen (Shell). Ohne --exit wird Exit 0 erwartet.
//   --stdout      Regex, die in stdout+stderr vorkommen MUSS (z. B. "\b0 failed\b").
//   --not-stdout  Regex, die NICHT vorkommen darf (z. B. "Error|TODO").
//   --file        Datei/Ordner muss existieren (mehrfach möglich).
//   --git-clean   Arbeitsbaum muss unverändert sein (git status leer).
//   --git-allow   Nur Änderungen in diesen Pfaden erlaubt (Glob mit * und **, mehrfach möglich).
//
// Exit 0 = alle Prüfungen grün, 1 = mindestens eine rot, 2 = falscher Aufruf.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const many = (n) => { const v = []; let i; while ((i = argv.indexOf("--" + n)) >= 0) v.push(argv.splice(i, 2)[1]); return v; };
const one = (n) => many(n).pop();
const flag = (n) => { const i = argv.indexOf("--" + n); if (i < 0) return false; argv.splice(i, 1); return true; };

const o = {
  cmd: one("cmd"), exit: one("exit"), stdout: one("stdout"), notStdout: one("not-stdout"),
  files: many("file"), allow: many("git-allow"), clean: flag("git-clean"), timeout: +(one("timeout") ?? 120),
};
const usage = () => { console.error("Nutzung: node verify.mjs [--cmd C] [--exit N] [--stdout RE] [--not-stdout RE] [--file P]... [--git-clean | --git-allow GLOB...]"); process.exit(2); };
if (argv.length || (!o.cmd && !o.files.length && !o.clean && !o.allow.length)) usage();
if ((o.stdout || o.notStdout || o.exit !== undefined) && !o.cmd) usage();
if (o.clean && o.allow.length) usage();
let reYes, reNo;
try { reYes = o.stdout && new RegExp(o.stdout, "m"); reNo = o.notStdout && new RegExp(o.notStdout, "m"); } catch (e) { console.error("Regex ungültig: " + e.message); process.exit(2); }

const results = [];
const check = (ok, what, detail = "") => results.push({ ok, what, detail });

if (o.cmd) {
  const r = spawnSync(o.cmd, { shell: true, encoding: "utf8", timeout: o.timeout * 1000, maxBuffer: 64 << 20 });
  const out = (r.stdout || "") + (r.stderr || "");
  const want = o.exit === undefined ? 0 : +o.exit;
  if (r.error) check(false, `Befehl läuft: ${o.cmd}`, r.error.code === "ETIMEDOUT" ? `Timeout nach ${o.timeout}s` : r.error.message);
  else check(r.status === want, `Exit-Code ${want}`, `war ${r.status}`);
  if (reYes) check(reYes.test(out), `Ausgabe enthält /${o.stdout}/`);
  if (reNo) { const m = out.match(reNo); check(!m, `Ausgabe ohne /${o.notStdout}/`, m ? `gefunden: „${m[0]}“` : ""); }
}
for (const f of o.files) check(existsSync(f), `existiert: ${f}`);

if (o.clean || o.allow.length) {
  const g = spawnSync("git", ["status", "--porcelain", "-uall"], { encoding: "utf8" });
  if (g.status !== 0) check(false, "git status", (g.stderr || "kein Git-Repo").trim());
  else {
    const changed = g.stdout.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, "").replace(/^"|"$/g, ""));
    if (o.clean) check(!changed.length, "Arbeitsbaum unverändert", changed.slice(0, 10).join(", "));
    else {
      const glob = (p) => new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*") + "$");
      const res = o.allow.map(glob), bad = changed.filter((f) => !res.some((re) => re.test(f)));
      check(!bad.length, `nur erlaubte Pfade geändert (${o.allow.join(", ")})`, bad.slice(0, 10).join(", "));
    }
  }
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.what}${!r.ok && r.detail ? "  –  " + r.detail : ""}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `NICHT fertig: ${bad} von ${results.length} Prüfungen rot.` : `Signal grün: ${results.length}/${results.length}.`);
process.exit(bad ? 1 : 0);
