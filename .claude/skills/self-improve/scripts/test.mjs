#!/usr/bin/env node
// Tests for si.mjs. Node >= 18, no dependencies. Exit 0 = all pass.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SI = path.join(path.dirname(fileURLToPath(import.meta.url)), "si.mjs");
const FIXTURE = `---
name: fixture
description: test fixture
---

# Fixture

<!-- INVARIANT START -->
Rule: never remove this.
<!-- INVARIANT END -->

Body line.
`;

let pass = 0, fail = 0;
function fresh() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "si-test-"));
  fs.writeFileSync(path.join(d, "SKILL.md"), FIXTURE);
  si(d, "init");
  return d;
}
function si(d, ...args) { return spawnSync(process.execPath, [SI, args[0], d, ...args.slice(1)], { encoding: "utf8" }); }
function t(name, fn) {
  try { fn(); pass++; console.log(`ok   ${name}`); }
  catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
}
function exit(r, code) { if (r.status !== code) throw new Error(`expected exit ${code}, got ${r.status}: ${(r.stderr || r.stdout).trim()}`); }
const edit = (d, f) => { const p = path.join(d, "SKILL.md"); fs.writeFileSync(p, f(fs.readFileSync(p, "utf8"))); };
const log = (d, outcome, friction = true) => si(d, "log", "--outcome", outcome, "--task", "t", ...(friction ? ["--friction", "f"] : []));

t("init + check on fresh skill", () => { exit(si(fresh(), "check"), 0); });

t("log rejects bad outcome (exit 2)", () => { exit(si(fresh(), "log", "--outcome", "great", "--task", "t"), 2); });

t("bump without friction is refused", () => {
  const d = fresh(); log(d, "ok", false); si(d, "snapshot"); exit(si(d, "bump", "--run", "r1", "--change", "x"), 1);
});

t("bump without snapshot is refused", () => {
  const d = fresh(); log(d, "partial"); exit(si(d, "bump", "--run", "r1", "--change", "x"), 1);
});

t("snapshot + edit + bump + check passes", () => {
  const d = fresh(); log(d, "partial"); si(d, "snapshot"); edit(d, (s) => s + "\nNew line.\n");
  exit(si(d, "bump", "--run", "r1", "--change", "x"), 0); exit(si(d, "check"), 0);
});

t("changed invariant block fails check", () => {
  const d = fresh(); edit(d, (s) => s.replace("never remove", "maybe remove")); exit(si(d, "check"), 1);
});

t("removed invariant block fails check", () => {
  const d = fresh(); edit(d, (s) => s.replace(/<!-- INVARIANT START -->[\s\S]*<!-- INVARIANT END -->/, "")); exit(si(d, "check"), 1);
});

t("edit without bump fails check (gap B)", () => {
  const d = fresh(); log(d, "partial"); si(d, "snapshot"); edit(d, (s) => s + "\nUnlogged.\n"); exit(si(d, "check"), 1);
});

t("CRLF-only change is not an unlogged edit", () => {
  const d = fresh(); edit(d, (s) => s.replace(/\n/g, "\r\n")); exit(si(d, "check"), 0);
});

t("legacy dir without approved.sha256: check fails, init repairs", () => {
  const d = fresh(); fs.rmSync(path.join(d, ".self-improve", "approved.sha256"));
  exit(si(d, "check"), 1); exit(si(d, "init"), 0); exit(si(d, "check"), 0);
});

t("missing frontmatter fails check", () => { const d = fresh(); edit(d, (s) => s.replace(/^---[\s\S]*?---\n/, "")); exit(si(d, "check"), 1); });

t("line budget exceeded fails check", () => { const d = fresh(); edit(d, (s) => s + "x\n".repeat(250)); exit(si(d, "check"), 1); });

t("regression: trend exit 3, revert restores content, check passes", () => {
  const d = fresh(); log(d, "ok"); log(d, "ok"); si(d, "snapshot");
  edit(d, (s) => s + "\nWorse.\n"); exit(si(d, "bump", "--run", "r2", "--change", "x"), 0);
  log(d, "fail"); log(d, "fail");
  exit(si(d, "trend"), 3); exit(si(d, "revert"), 0); exit(si(d, "check"), 0);
  if (fs.readFileSync(path.join(d, "SKILL.md"), "utf8") !== FIXTURE) throw new Error("content not restored");
});

t("no regression: trend exit 0", () => {
  const d = fresh(); log(d, "partial"); si(d, "snapshot"); exit(si(d, "bump", "--run", "r1", "--change", "x"), 0);
  log(d, "ok"); log(d, "ok"); exit(si(d, "trend"), 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
