#!/usr/bin/env node
// Tests for pcc.mjs. Node >= 18, no dependencies. Exit 0 = all pass.
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lintRequest, usageReport, minTokens, readFactor, normModel } from "./pcc.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, "..", "examples");
const cli = (...a) => spawnSync(process.execPath, [path.join(HERE, "pcc.mjs"), ...a], { encoding: "utf8" });

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`ok   ${name}`); }
  catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
}
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const has = (f, level, re) => { if (!f.some((x) => x.level === level && re.test(x.msg))) throw new Error(`no ${level} matching ${re}: ${JSON.stringify(f)}`); };
const none = (f, level) => eq(f.filter((x) => x.level === level).length, 0);
const cc = (ttl) => ({ type: "ephemeral", ...(ttl ? { ttl } : {}) });
const long = "x".repeat(8000);

t("model ids normalize", () => { eq(normModel("claude-opus-5-5"), "opus-5-5"); eq(normModel("us.anthropic.claude-haiku-4-5-20251001"), "haiku-4-5"); });
t("min tokens per model", () => { eq(minTokens("claude-opus-5-5"), 512); eq(minTokens("claude-sonnet-5"), 1024); eq(minTokens("claude-opus-4-7"), 2048); eq(minTokens("claude-haiku-4-5"), 4096); eq(minTokens("gpt-x"), null); });
t("read factor per model", () => { eq(readFactor("claude-fable-5-2"), 0.025); eq(readFactor("claude-sonnet-5-5"), 0.05); eq(readFactor("claude-haiku-5-5"), 0.1); });

t("no cache_control → WARN", () => has(lintRequest({ model: "claude-opus-5-5", messages: [{ role: "user", content: "hi" }] }), "WARN", /Caching ist aus/));
t("4 explicit + auto → ERROR 400", () => {
  const body = { model: "claude-opus-5-5", cache_control: cc(), system: [1, 2, 3, 4].map((i) => ({ type: "text", text: long + i, cache_control: cc() })), messages: [] };
  has(lintRequest(body), "ERROR", /400/);
});
t("exactly 4 explicit is fine", () => {
  const body = { model: "claude-opus-5-5", system: [1, 2, 3, 4].map((i) => ({ type: "text", text: long + i, cache_control: cc() })), messages: [] };
  none(lintRequest(body), "ERROR");
});
t("1h after 5m → ERROR", () => {
  const body = { model: "claude-opus-5-5", system: [{ type: "text", text: long, cache_control: cc() }, { type: "text", text: "b", cache_control: cc("1h") }], messages: [] };
  has(lintRequest(body), "ERROR", /längere TTL/);
});
t("1h before 5m is fine", () => {
  const body = { model: "claude-opus-5-5", system: [{ type: "text", text: long, cache_control: cc("1h") }, { type: "text", text: "b", cache_control: cc() }], messages: [] };
  none(lintRequest(body), "ERROR");
});
t("timestamp before breakpoint → WARN", () => {
  const body = { model: "claude-opus-5-5", system: [{ type: "text", text: `Stand 2026-11-24T10:00 ${long}`, cache_control: cc() }], messages: [] };
  has(lintRequest(body), "WARN", /Zeitstempel/);
});
t("timestamp after last breakpoint is ignored", () => {
  const body = { model: "claude-opus-5-5", system: [{ type: "text", text: long, cache_control: cc() }], messages: [{ role: "user", content: "Stand 2026-11-24T10:00" }] };
  none(lintRequest(body), "WARN");
});
t("short prefix → WARN below minimum", () => {
  const body = { model: "claude-haiku-4-5", system: [{ type: "text", text: long, cache_control: cc() }], messages: [] };
  has(lintRequest(body), "WARN", /Minimum 4096/);
});

t("usage report math", () => {
  const r = usageReport([
    { usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000 } },
    { usage: { input_tokens: 0, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 } },
  ], "claude-haiku-5-5");
  eq(r.hitRate, 0.5); eq(r.costFactor, (1000 * 1.25 + 1000 * 0.1) / 2000);
});
t("usage: 1h writes priced at 2x", () => {
  const r = usageReport([{ input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 100, cache_creation: { ephemeral_1h_input_tokens: 100 } }], "claude-opus-5-5");
  eq(r.w1, 100); eq(r.w5, 0); eq(r.costFactor, 2);
});
t("usage: repeated writes without reads counted", () => {
  const w = { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 900 };
  eq(usageReport([w, w, w], "claude-opus-5-5").rewrites, 2);
});

t("CLI: good example exit 0", () => eq(cli("request", path.join(EX, "request-good.json")).status, 0));
t("CLI: bad example exit 1", () => eq(cli("request", path.join(EX, "request-bad.json")).status, 1));
t("CLI: usage example exit 0", () => eq(cli("usage", path.join(EX, "usage.jsonl"), "--model", "claude-opus-5-5").status, 0));
t("CLI: --min-hit fails below threshold", () => eq(cli("usage", path.join(EX, "usage.jsonl"), "--model", "claude-opus-5-5", "--min-hit", "0.9").status, 1));
t("CLI: missing args exit 2", () => eq(cli("request").status, 2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
