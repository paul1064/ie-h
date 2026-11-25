#!/usr/bin/env node
// prompt-cache-check: lint a Claude Messages request body for prompt caching,
// or report cache hit rate + cost from logged usage objects. Node >= 18, no deps.
// Exit: 0 = ok, 1 = findings with ERROR (request) / hit rate below --min-hit (usage), 2 = usage error.
import fs from "node:fs";

const MAX_BREAKPOINTS = 4;
const CHARS_PER_TOKEN = 4; // rough estimate, good enough for a minimum-length warning

// Source: platform.claude.com/docs/de/build-with-claude/prompt-caching (Stand 2026-11-24)
const MIN_TOKENS = [
  [/^(opus-5-5|opus-5|sonnet-5-5|haiku-5-5|fable-5(-[12])?|mythos-5(-[12])?)$/, 512],
  [/^(sonnet-5|opus-4-8|sonnet-4(-[56])?|opus-4(-1)?)$/, 1024],
  [/^(opus-4-7|mythos-preview)$/, 2048],
  [/^(opus-4-[56]|haiku-4-5)$/, 4096],
];
const READ_FACTOR = [
  [/^(fable|mythos)-5-[12]$/, 0.025],
  [/^(opus|sonnet)-5-5$/, 0.05],
];
const WRITE_FACTOR = { "5m": 1.25, "1h": 2 };

export function normModel(id = "") {
  return String(id).toLowerCase().replace(/^.*claude-/, "").replace(/-\d{8}$/, "").replace(/\[.*\]$/, "");
}
export const minTokens = (m) => MIN_TOKENS.find(([re]) => re.test(normModel(m)))?.[1] ?? null;
export const readFactor = (m) => READ_FACTOR.find(([re]) => re.test(normModel(m)))?.[1] ?? 0.1;

const VOLATILE = [
  [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, "Zeitstempel"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "UUID"],
  [/\b(heute ist|today is|current (date|time))\b/i, "Datumsangabe"],
];

const textOf = (b) => (typeof b === "string" ? b : JSON.stringify(b));

// Walk the prompt in cache order: tools -> system -> messages. Yields {where, block, text}.
function* walk(body) {
  for (const [i, t] of (body.tools ?? []).entries()) yield { where: `tools[${i}]`, block: t, text: textOf(t) };
  if (typeof body.system === "string") yield { where: "system", block: {}, text: body.system };
  else for (const [i, b] of (body.system ?? []).entries()) yield { where: `system[${i}]`, block: b, text: textOf(b) };
  for (const [i, m] of (body.messages ?? []).entries()) {
    if (typeof m.content === "string") { yield { where: `messages[${i}]`, block: m, text: m.content }; continue; }
    for (const [j, b] of (m.content ?? []).entries()) yield { where: `messages[${i}].content[${j}]`, block: b, text: textOf(b) };
  }
}

export function lintRequest(body, modelOverride) {
  const out = [];
  const add = (level, msg) => out.push({ level, msg });
  const model = modelOverride ?? body.model;
  const auto = !!body.cache_control;
  const blocks = [...walk(body)];
  const bps = blocks.filter((b) => b.block && typeof b.block === "object" && b.block.cache_control);

  if (!auto && bps.length === 0) add("WARN", "Kein cache_control – Caching ist aus. Für den Start: cache_control={type:'ephemeral'} auf oberster Ebene.");
  const slots = bps.length + (auto ? 1 : 0);
  if (slots > MAX_BREAKPOINTS) add("ERROR", `${slots} Breakpoints (${bps.length} explizit${auto ? " + 1 automatisch" : ""}) > ${MAX_BREAKPOINTS} → API antwortet 400.`);

  // TTL order: entries with longer TTL must come before shorter ones.
  let seen5m = null;
  for (const b of bps) {
    const ttl = b.block.cache_control.ttl ?? "5m";
    if (ttl === "5m" && !seen5m) seen5m = b.where;
    if (ttl === "1h" && seen5m) add("ERROR", `${b.where} hat ttl 1h nach 5m-Breakpoint ${seen5m} – längere TTL muss vorne stehen.`);
  }

  // Volatile content at/before the last explicit breakpoint invalidates the cache each call.
  const lastIdx = bps.length ? blocks.indexOf(bps[bps.length - 1]) : -1;
  for (const b of blocks.slice(0, lastIdx + 1)) {
    for (const [re, what] of VOLATILE) if (re.test(b.text)) add("WARN", `${what} in ${b.where} vor/auf einem Breakpoint – ändert den Präfix bei jeder Anfrage.`);
  }
  // Same check for system/tools when only automatic caching is used.
  if (auto && !bps.length) {
    for (const b of blocks.filter((x) => !x.where.startsWith("messages"))) {
      for (const [re, what] of VOLATILE) if (re.test(b.text)) add("WARN", `${what} in ${b.where} – bricht den automatischen Cache bei jeder Anfrage. Nach hinten verschieben.`);
    }
  }

  // Minimum cacheable length (estimate).
  const min = minTokens(model);
  if (min === null && model) add("INFO", `Modell '${model}' unbekannt – Mindestlänge nicht geprüft.`);
  if (min !== null && (auto || bps.length)) {
    const upto = auto && !bps.length ? blocks.length - 1 : lastIdx;
    const est = Math.round(blocks.slice(0, upto + 1).reduce((n, b) => n + b.text.length, 0) / CHARS_PER_TOKEN);
    if (est < min) add("WARN", `Präfix ≈ ${est} Token < Minimum ${min} für ${normModel(model)} – wird ohne Fehler NICHT gecacht.`);
    else add("INFO", `Präfix ≈ ${est} Token ≥ Minimum ${min}.`);
  }
  return out;
}

export function usageReport(records, model) {
  const rf = readFactor(model);
  const s = { n: 0, input: 0, read: 0, w5: 0, w1: 0, misses: 0, rewrites: 0 };
  let prevWrote = false;
  for (const rec of records) {
    const u = rec.usage ?? rec;
    if (typeof u.input_tokens !== "number") continue;
    s.n++;
    const read = u.cache_read_input_tokens ?? 0;
    const created = u.cache_creation_input_tokens ?? 0;
    const w1 = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    s.input += u.input_tokens; s.read += read; s.w1 += w1; s.w5 += created - w1;
    if (!read && !created) s.misses++;
    if (created && !read && prevWrote) s.rewrites++;
    prevWrote = created > 0 && !read;
  }
  const total = s.input + s.read + s.w5 + s.w1;
  const cost = s.input + s.w5 * WRITE_FACTOR["5m"] + s.w1 * WRITE_FACTOR["1h"] + s.read * rf;
  return { ...s, total, readFactor: rf, hitRate: total ? s.read / total : 0, costFactor: total ? cost / total : 1 };
}

function main(argv) {
  const [cmd, file, ...rest] = argv;
  const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  if (!cmd || !file || !["request", "usage"].includes(cmd)) {
    console.error("usage: pcc.mjs request <body.json> [--model id]\n       pcc.mjs usage <log.jsonl> --model id [--min-hit 0.5]");
    return 2;
  }
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch (e) { console.error(e.message); return 2; }

  if (cmd === "request") {
    let body; try { body = JSON.parse(raw); } catch (e) { console.error(`kein gültiges JSON: ${e.message}`); return 2; }
    const f = lintRequest(body, opt("--model"));
    for (const x of f) console.log(`${x.level.padEnd(5)} ${x.msg}`);
    const errs = f.filter((x) => x.level === "ERROR").length, warns = f.filter((x) => x.level === "WARN").length;
    console.log(`\n${errs} ERROR, ${warns} WARN`);
    return errs ? 1 : 0;
  }

  const model = opt("--model");
  if (!model) { console.error("--model fehlt (bestimmt den Lese-Faktor)"); return 2; }
  const recs = raw.split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const r = usageReport(recs, model);
  if (!r.n) { console.error("keine usage-Objekte gefunden"); return 2; }
  const pct = (x) => `${(x * 100).toFixed(1)} %`;
  console.log(`Anfragen          ${r.n}`);
  console.log(`Input gesamt      ${r.total} Token (gelesen ${r.read}, geschrieben 5m ${r.w5} / 1h ${r.w1}, ungecacht ${r.input})`);
  console.log(`Trefferquote      ${pct(r.hitRate)}`);
  console.log(`Kosten vs. ohne   ${pct(r.costFactor)}  (Lese-Faktor ${r.readFactor}) → Ersparnis ${pct(1 - r.costFactor)}`);
  if (r.misses) console.log(`WARN  ${r.misses} Anfrage(n) ohne Lesen und Schreiben – Präfix unter Mindestlänge oder kein cache_control.`);
  if (r.rewrites) console.log(`WARN  ${r.rewrites}× erneut geschrieben ohne Treffer – Präfix ändert sich zwischen Anfragen oder TTL abgelaufen.`);
  const minHit = opt("--min-hit");
  return minHit !== undefined && r.hitRate < Number(minHit) ? 1 : 0;
}

if (process.argv[1]?.endsWith("pcc.mjs")) {
  process.exit(main(process.argv.slice(2)));
}
