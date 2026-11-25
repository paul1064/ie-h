#!/usr/bin/env node
// Prüft im gesamten Repository, ob alle Skills, Manifeste, README-Einträge,
// .self-improve-Prüfsummen und Hygiene-Regeln zusammenpassen.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { lintSkillDir } from "../.claude/skills/workflow-skill-creator/scripts/scaffold.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const problems = [];
const bad = (m) => problems.push(m);

const skillRoot = join(root, ".claude/skills");
const skills = readdirSync(skillRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const readme = read("README.md");
const si = join(skillRoot, "self-improve/scripts/si.mjs");

for (const s of skills) {
  const dir = join(skillRoot, s);
  for (const err of lintSkillDir(dir)) bad(err);
  if (!readme.includes("`" + s + "`")) bad(`README.md: Skill '${s}' fehlt in der Übersicht`);
  const r = spawnSync(process.execPath, [si, "check", dir], { encoding: "utf8" });
  if (r.status !== 0) bad(`si.mjs check (${s}): ${(r.stderr || r.stdout).trim()}`);
}

let plugin, market;
try { plugin = JSON.parse(read(".claude-plugin/plugin.json")); } catch { bad(".claude-plugin/plugin.json: ungültiges JSON"); }
try { market = JSON.parse(read(".claude-plugin/marketplace.json")); } catch { bad(".claude-plugin/marketplace.json: ungültiges JSON"); }
if (plugin && !/^\d+\.\d+\.\d+$/.test(plugin.version)) bad(`plugin.json: version '${plugin.version}' ist nicht x.y.z`);
for (const p of market?.plugins || []) {
  if (p.name !== plugin?.name) bad(`marketplace.json: Plugin '${p.name}' != '${plugin?.name}'`);
}

for (const p of problems) console.error("ABWEICHUNG  " + p);
console.log(`skills=${skills.length} (${skills.join(", ")})  abweichungen=${problems.length}`);
process.exit(problems.length ? 1 : 0);
