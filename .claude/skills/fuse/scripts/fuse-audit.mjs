#!/usr/bin/env node
// Prüft, ob ein verschmolzenes Ziel-Repository alle Skills seiner Quell-Repositories
// vollständig, sauber und ohne Hygiene-Verstöße übernommen hat.
//   node fuse-audit.mjs --sources <repoA> <repoB> [...] --target <targetRepo> [--exclude name...]
// Exit 0 = lückenlos & sauber, 1 = Lücke oder Hygiene-Verstoß, 2 = falscher Aufruf.
import fs from "node:fs";
import path from "node:path";

const BLOCKED_TERM = new RegExp("\\b" + ["chem", "istry"].join("") + "\\b", "i");
const BLOCKED = [BLOCKED_TERM, /\bsk-ant-[a-z0-9_-]{10,}/i, /\bgh[pousr]_[A-Za-z0-9_]{20,}/];

function listSkills(repoRoot) {
  const root = path.resolve(repoRoot);
  const out = new Map();
  for (const sub of [".claude/skills", "skills"]) {
    const p = path.join(root, sub);
    if (!fs.existsSync(p)) continue;
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const sd = path.join(p, e.name);
      if (fs.existsSync(path.join(sd, "SKILL.md"))) {
        const hasScripts = fs.existsSync(path.join(sd, "scripts")) &&
          fs.readdirSync(path.join(sd, "scripts")).some((f) => /\.(mjs|js)$/.test(f));
        out.set(e.name, { dir: sd, hasScripts });
      }
    }
  }
  return out;
}

export function auditFusion({ sources, target, exclude = [] }) {
  const excluded = new Set(exclude);
  const targetSkills = listSkills(target);
  const problems = [];
  const expected = new Map();

  for (const src of sources) {
    for (const [name, info] of listSkills(src)) {
      if (excluded.has(name)) continue;
      const prev = expected.get(name);
      expected.set(name, { hasScripts: Boolean(prev?.hasScripts || info.hasScripts), from: [...(prev?.from ?? []), path.basename(path.resolve(src))] });
    }
  }

  for (const [name, req] of expected) {
    const got = targetSkills.get(name);
    if (!got) { problems.push(`Skill '${name}' aus [${req.from.join(", ")}] fehlt im Ziel-Repo`); continue; }
    if (req.hasScripts && !got.hasScripts) problems.push(`Skill '${name}' hatte Skripte in Quelle, aber keine im Ziel-Repo`);
  }

  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(md|mjs|js|json|ya?ml|sh)$/i.test(e.name) && !["fuse-audit.mjs", "evolve-check.mjs", "scaffold.mjs"].includes(e.name) && !/(^|[\/._-])tests?[\/._-]/i.test(path.relative(target, full))) {
        const txt = fs.readFileSync(full, "utf8");
        for (const re of BLOCKED) if (re.test(txt)) problems.push(`Hygiene-Verstoß in ${path.relative(target, full)}: ${re}`);
      }
    }
  };
  walk(path.resolve(target));

  return {
    sources_count: sources.length,
    expected_skills: [...expected.keys()].sort(),
    target_skills: [...targetSkills.keys()].sort(),
    problems,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const sources = [], exclude = [];
  let target = null, mode = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--sources") { mode = "sources"; continue; }
    if (argv[i] === "--exclude") { mode = "exclude"; continue; }
    if (argv[i] === "--target") { target = argv[++i]; mode = null; continue; }
    if (mode === "sources") sources.push(argv[i]);
    else if (mode === "exclude") exclude.push(argv[i]);
    else { mode = null; }
  }
  if (!sources.length || !target) {
    console.error("Nutzung: fuse-audit.mjs --sources <repoA> <repoB> --target <zielRepo> [--exclude skill...]");
    process.exit(2);
  }
  const res = auditFusion({ sources, target, exclude });
  for (const p of res.problems) console.error("FEHLER  " + p);
  console.log(`quell_skills=${res.expected_skills.length} ziel_skills=${res.target_skills.length} (${res.target_skills.join(", ")}) fehler=${res.problems.length}`);
  process.exit(res.problems.length ? 1 : 0);
}
