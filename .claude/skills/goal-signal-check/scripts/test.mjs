#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const V = fileURLToPath(new URL("./verify.mjs", import.meta.url));
const run = (args, cwd) => spawnSync(process.execPath, [V, ...args], { encoding: "utf8", cwd });
const node = (js) => `"${process.execPath}" -e "${js}"`;

test("grün: Exit 0 und erwartete Ausgabe", () => {
  const r = run(["--cmd", node("console.log('3 passed, 0 failed')"), "--stdout", "\\b0 failed"]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Signal grün: 2\/2/);
});

test("rot: falscher Exit-Code und --not-stdout Köder-Erkennung", () => {
  assert.equal(run(["--cmd", node("process.exit(3)")]).status, 1);
  assert.equal(run(["--cmd", node("process.exit(1)"), "--exit", "1"]).status, 0);
  const r = run(["--cmd", node("console.log('Fertig! (TODO: echte Prüfung)')"), "--not-stdout", "TODO"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /gefunden: „TODO“/);
});

test("--file, --git-clean und --git-allow", () => {
  assert.equal(run(["--file", V]).status, 0);
  assert.equal(run(["--file", "/gibt/es/nicht"]).status, 1);

  const d = mkdtempSync(join(tmpdir(), "verify-"));
  const git = (...a) => spawnSync("git", a, { cwd: d });
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  writeFileSync(join(d, "a.txt"), "1"); git("add", "."); git("commit", "-qm", "init");
  assert.equal(run(["--git-clean"], d).status, 0);
  writeFileSync(join(d, "a.txt"), "2");
  assert.equal(run(["--git-clean"], d).status, 1);
  assert.equal(run(["--git-allow", "*.txt"], d).status, 0);
  assert.equal(run(["--git-allow", "src/**"], d).status, 1);
});

test("falscher Aufruf -> Exit 2", () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(["--stdout", "x"]).status, 2);
  assert.equal(run(["--git-clean", "--git-allow", "x"]).status, 2);
});
