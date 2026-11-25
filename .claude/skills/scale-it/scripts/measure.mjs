#!/usr/bin/env node
// Ausgangslage eines Projekts erfassen und zwei Messungen vergleichen.
//
//   node measure.mjs [verzeichnis] --json > vorher.json     Messung speichern
//   node measure.mjs [verzeichnis]                          Messung als Tabelle
//   node measure.mjs [verzeichnis] --compare vorher.json    Faktor je Messgröße
//
// Zählt nur, was sich ohne Projektwissen zählen lässt (Dateien, Zeilen, Tests, CI, größte Datei).
// Gibt Beobachtungen aus, kein Urteil: ob ein Faktor gut ist, entscheidet der Plan, nicht dieses Skript.
// Fachliche Messgrößen (Features, Durchsatz, Laufzeit) kommen aus den Befehlen des Projekts dazu.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const argv = process.argv.slice(2);
const take = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv.splice(i, 2)[1]; };
const compare = take("--compare"), json = argv.includes("--json") && argv.splice(argv.indexOf("--json"), 1);
const root = resolve(argv[0] || ".");

const SKIP = new Set([".git", "node_modules", "dist", "build", "target", ".venv", "__pycache__", "Library", "Temp"]);
const CODE = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".cs", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".c", ".cpp", ".h", ".swift", ".gd", ".sh", ".vue", ".svelte"]);
const TEST = /(^|[\/._-])(tests?|specs?|__tests__)([\/._-]|$)/i;

function files() {
  try {           // git kennt .gitignore; ohne git: Verzeichnis ablaufen
    return execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
  } catch {
    const out = [], walk = (d, rel) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(join(d, e.name), r); else if (e.isFile()) out.push(r);
    } };
    walk(root, "");
    return out;
  }
}

function measure() {
  const m = { dateien: 0, code_dateien: 0, code_zeilen: 0, test_dateien: 0, test_zeilen: 0, doku_dateien: 0, daten_dateien: 0, groesste_code_datei_zeilen: 0 };
  let biggest = "";
  for (const f of files()) {
    const p = join(root, f), ext = extname(f).toLowerCase();
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    m.dateien++;
    if (ext === ".md") m.doku_dateien++;
    if ([".json", ".yaml", ".yml", ".csv", ".toml"].includes(ext)) m.daten_dateien++;
    if (!CODE.has(ext)) continue;
    const lines = readFileSync(p, "utf8").split("\n").length;
    if (TEST.test(f)) { m.test_dateien++; m.test_zeilen += lines; continue; }
    m.code_dateien++; m.code_zeilen += lines;
    if (lines > m.groesste_code_datei_zeilen) { m.groesste_code_datei_zeilen = lines; biggest = f; }
  }
  m.ci_workflows = existsSync(join(root, ".github/workflows")) ? readdirSync(join(root, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f)).length : 0;
  return { verzeichnis: root, groesste_code_datei: biggest, werte: m };
}

const now = measure();
if (json) { console.log(JSON.stringify(now, null, 2)); process.exit(0); }
const before = compare ? JSON.parse(readFileSync(compare, "utf8")).werte : null;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("messgröße", 30) + (before ? pad("vorher", 10) + pad("nachher", 10) + "faktor" : "wert"));
for (const [k, v] of Object.entries(now.werte)) {
  if (!before) { console.log(pad(k, 30) + v); continue; }
  const b = before[k] ?? 0, f = b ? "×" + (v / b).toFixed(2) : v ? "neu" : "–";
  console.log(pad(k, 30) + pad(b, 10) + pad(v, 10) + f);
}
if (now.groesste_code_datei) console.log("größte code-datei: " + now.groesste_code_datei);
