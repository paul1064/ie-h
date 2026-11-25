#!/usr/bin/env node
// Legt ein sauberes Skill-Gerüst an oder prüft bestehende Skills auf Struktur & Hygiene.
//   node scaffold.mjs init <skillDir> --description "..."
//   node scaffold.mjs lint <skillDir>...
// Exit 0 = ok, 1 = Befund, 2 = falscher Aufruf. Node >= 18, keine Abhängigkeiten.
import fs from "node:fs";
import path from "node:path";

const MAX_LINES = 200;
const MAX_DESC = 1024;
const BLOCKED_TERM = new RegExp("\\b" + ["chem", "istry"].join("") + "\\b", "i");
const BLOCKED = [
  [BLOCKED_TERM, "gesperrter Domänenbegriff"],
  [/\bsk-ant-[a-z0-9_-]{10,}/i, "Anthropic-Schlüssel/Token"],
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}/, "GitHub-Token"],
  [/[A-Za-z]:\\Users\\[A-Za-z0-9_.-]+/, "lokaler Windows-Benutzerpfad"],
];

export function lintSkillDir(dir) {
  const d = path.resolve(dir);
  const name = path.basename(d);
  const skillFile = path.join(d, "SKILL.md");
  const errors = [];
  if (!fs.existsSync(skillFile)) return [`${name}: SKILL.md fehlt`];
  const raw = fs.readFileSync(skillFile, "utf8");
  const lines = raw.split(/\r?\n/).length;
  if (lines > MAX_LINES) errors.push(`${name}: SKILL.md hat ${lines} Zeilen (Budget ${MAX_LINES})`);

  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!fm) errors.push(`${name}: YAML-Frontmatter fehlt`);
  else {
    const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(fm[1])?.[1]?.trim().replace(/^["']|["']$/g, "");
    const fmName = field("name");
    const desc = field("description") ?? "";
    if (fmName !== name) errors.push(`${name}: Frontmatter name '${fmName ?? ""}' != Ordner '${name}'`);
    if (!desc) errors.push(`${name}: Frontmatter description fehlt`);
    if (desc.length > MAX_DESC) errors.push(`${name}: description ${desc.length} Zeichen > ${MAX_DESC}`);
  }

  if (!/<!-- INVARIANT START -->[\s\S]+<!-- INVARIANT END -->/.test(raw)) {
    errors.push(`${name}: Invarianten-Block (<!-- INVARIANT START/END -->) fehlt`);
  }

  for (const m of raw.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)) {
    if (!fs.existsSync(path.join(d, m[1]))) errors.push(`${name}: fehlender Verweis ${m[1]}`);
  }

  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(md|mjs|js|json|ya?ml|sh)$/i.test(e.name)) {
        const txt = fs.readFileSync(full, "utf8");
        for (const [re, label] of BLOCKED) {
          if (re.test(txt)) errors.push(`${name}/${path.relative(d, full)}: Hygiene-Verstoß (${label})`);
        }
      }
    }
  };
  walk(d);
  return errors;
}

export function initSkillDir(dir, description) {
  const d = path.resolve(dir);
  const name = path.basename(d);
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Ungültiger Skill-Name '${name}' (nur a-z, 0-9, -)`);
  const skillFile = path.join(d, "SKILL.md");
  if (fs.existsSync(skillFile)) throw new Error(`SKILL.md existiert bereits in ${d}`);
  fs.mkdirSync(d, { recursive: true });
  const title = name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("-");
  fs.writeFileSync(skillFile, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${title}\n\n<!-- INVARIANT START -->\n## Invarianten\n\n1. Kein Befund, keine Änderung.\n2. Keine Geheimnisse, Tokens oder gesperrten Begriffe im Repository.\n<!-- INVARIANT END -->\n\n## Ablauf\n\n1. Ausgangslage lesen und Erfolgssignal festlegen.\n2. Änderung minimal und prüfbar umsetzen.\n3. Gegenprobe im Echtsystem ausführen.\n`);
  return skillFile;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "init") {
    const idx = rest.indexOf("--description");
    const desc = idx >= 0 ? rest.splice(idx, 2)[1] : "";
    if (!rest[0] || !desc) { console.error("Nutzung: scaffold.mjs init <skillDir> --description \"...\""); process.exit(2); }
    try { const f = initSkillDir(rest[0], desc); console.log(`angelegt: ${f}`); process.exit(0); }
    catch (e) { console.error(e.message); process.exit(1); }
  }
  if (cmd === "lint" && rest.length) {
    const all = rest.flatMap((d) => lintSkillDir(d));
    for (const e of all) console.error("FEHLER  " + e);
    console.log(`geprüft=${rest.length}  fehler=${all.length}`);
    process.exit(all.length ? 1 : 0);
  }
  console.error("Nutzung: scaffold.mjs <init|lint> <skillDir> [...]");
  process.exit(2);
}
