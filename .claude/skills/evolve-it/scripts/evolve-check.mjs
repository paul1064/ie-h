#!/usr/bin/env node
// Misst den Evolutionsstand eines Repositories (Skills, Skripte, Tests, Hygiene)
// und vergleicht ihn gegen eine gesicherte Ausgangslage.
//   node evolve-check.mjs baseline [dir] [--out vorher.json]
//   node evolve-check.mjs verify   [dir] [--baseline vorher.json]
// Exit 0 = alle Prüfungen grün & keine Regression, 1 = Fehler/Regression, 2 = falscher Aufruf.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BLOCKED_TERM = new RegExp("\\b" + ["chem", "istry"].join("") + "\\b", "i");
const FORBIDDEN = [BLOCKED_TERM, /\bsk-ant-[a-z0-9_-]{10,}/i, /\bgh[pousr]_[A-Za-z0-9_]{20,}/];

function walkFiles(root) {
  const out = [];
  const skip = new Set([".git", "node_modules", "dist", "build"]);
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.isFile()) out.push(p);
    }
  };
  rec(root);
  return out;
}

export function collectSnapshot(rootDir) {
  const root = path.resolve(rootDir);
  const skillRoot = fs.existsSync(path.join(root, ".claude/skills"))
    ? path.join(root, ".claude/skills")
    : fs.existsSync(path.join(root, "skills"))
      ? path.join(root, "skills")
      : null;

  const skills = skillRoot
    ? fs.readdirSync(skillRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [];

  let scripts = 0, testFiles = 0, hygieneViolations = [];
  for (const f of walkFiles(root)) {
    const rel = path.relative(root, f);
    if (/\.(mjs|js)$/.test(f)) {
      if (/(^|[\/._-])(tests?|specs?)([\/._-]|$)/i.test(rel)) testFiles++;
      else scripts++;
    }
    if (/\.(md|mjs|js|json|ya?ml|sh)$/i.test(f) && !rel.endsWith("evolve-check.mjs") && !rel.endsWith("scaffold.mjs") && !rel.endsWith("fuse-audit.mjs") && !/(^|[\/._-])tests?[\/._-]/i.test(rel)) {
      const txt = fs.readFileSync(f, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(txt)) hygieneViolations.push(`${rel}: Treffer auf ${re}`);
      }
    }
  }
  return {
    ts: new Date().toISOString(),
    root,
    skills_count: skills.length,
    skills,
    scripts_count: scripts,
    test_files_count: testFiles,
    hygiene_violations: hygieneViolations,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const take = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv.splice(i, 2)[1]; };
  const outFile = take("--out");
  const baseFile = take("--baseline");
  const [cmd, dirArg] = argv;
  if (!cmd || !["baseline", "verify"].includes(cmd)) {
    console.error("Nutzung: evolve-check.mjs <baseline|verify> [dir] [--out datei | --baseline datei]");
    process.exit(2);
  }
  const root = path.resolve(dirArg || ".");
  const snap = collectSnapshot(root);

  if (cmd === "baseline") {
    const json = JSON.stringify(snap, null, 2);
    if (outFile) fs.writeFileSync(outFile, json + "\n");
    console.log(`Baseline erfasst: skills=${snap.skills_count} skripte=${snap.scripts_count} test_dateien=${snap.test_files_count} hygiene_fehler=${snap.hygiene_violations.length}`);
    process.exit(snap.hygiene_violations.length ? 1 : 0);
  }

  const errors = [...snap.hygiene_violations];
  if (baseFile && fs.existsSync(baseFile)) {
    const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
    if (snap.skills_count < base.skills_count) errors.push(`Skills geschrumpft: ${snap.skills_count} < ${base.skills_count}`);
    if (snap.test_files_count < base.test_files_count) errors.push(`Testdateien geschrumpft: ${snap.test_files_count} < ${base.test_files_count}`);
  }

  const siScript = path.join(root, ".claude/skills/self-improve/scripts/si.mjs");
  if (fs.existsSync(siScript)) {
    for (const s of snap.skills) {
      const sd = path.join(root, ".claude/skills", s);
      if (fs.existsSync(path.join(sd, ".self-improve"))) {
        const r = spawnSync(process.execPath, [siScript, "check", sd], { encoding: "utf8" });
        if (r.status !== 0) errors.push(`si.mjs check fehlgeschlagen für ${s}: ${(r.stderr || r.stdout).trim()}`);
      }
    }
  }

  for (const e of errors) console.error("FEHLER  " + e);
  console.log(`verify: skills=${snap.skills_count} skripte=${snap.scripts_count} test_dateien=${snap.test_files_count} fehler=${errors.length}`);
  process.exit(errors.length ? 1 : 0);
}
