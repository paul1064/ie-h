#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const M = fileURLToPath(new URL("./measure.mjs", import.meta.url));
const run = (args) => spawnSync(process.execPath, [M, ...args], { encoding: "utf8" });

test("measure.mjs erfasst JSON-Ausgangslage und berechnet Faktoren mit --compare", () => {
  const d = mkdtempSync(join(tmpdir(), "measure-"));
  mkdirSync(join(d, "src"));
  mkdirSync(join(d, "tests"));
  writeFileSync(join(d, "src/a.mjs"), "export const x = 1;\n");
  writeFileSync(join(d, "tests/a.test.mjs"), "import './a.mjs';\n");
  writeFileSync(join(d, "README.md"), "# Demo\n");

  const r1 = run([d, "--json"]);
  assert.equal(r1.status, 0);
  const j1 = JSON.parse(r1.stdout);
  assert.equal(j1.werte.code_dateien, 1);
  assert.equal(j1.werte.test_dateien, 1);
  assert.equal(j1.werte.doku_dateien, 1);

  const beforeFile = join(d, "vorher.json");
  writeFileSync(beforeFile, r1.stdout);

  writeFileSync(join(d, "src/b.mjs"), "export const y = 2;\n");
  writeFileSync(join(d, "tests/b.test.mjs"), "import './b.mjs';\n");

  const r2 = run([d, "--compare", beforeFile]);
  assert.equal(r2.status, 0);
  assert.match(r2.stdout, /code_dateien\s+1\s+2\s+×2\.00/);
  assert.match(r2.stdout, /test_dateien\s+1\s+2\s+×2\.00/);
});
