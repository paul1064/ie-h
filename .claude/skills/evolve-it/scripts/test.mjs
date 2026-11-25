#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const EV = fileURLToPath(new URL("./evolve-check.mjs", import.meta.url));
const run = (args) => spawnSync(process.execPath, [EV, ...args], { encoding: "utf8" });

test("evolve-check erfasst Baseline und erkennt geschrumpfte Skills oder Hygiene-Fehler", () => {
  const root = mkdtempSync(join(tmpdir(), "ev-"));
  mkdirSync(join(root, ".claude/skills/alpha/scripts"), { recursive: true });
  mkdirSync(join(root, ".claude/skills/beta"), { recursive: true });
  writeFileSync(join(root, ".claude/skills/alpha/SKILL.md"), "---\nname: alpha\ndescription: a\n---\n");
  writeFileSync(join(root, ".claude/skills/beta/SKILL.md"), "---\nname: beta\ndescription: b\n---\n");
  writeFileSync(join(root, ".claude/skills/alpha/scripts/test.mjs"), "// test\n");

  const base = join(root, "base.json");
  assert.equal(run(["baseline", root, "--out", base]).status, 0);
  assert.equal(run(["verify", root, "--baseline", base]).status, 0);

  rmSync(join(root, ".claude/skills/beta"), { recursive: true, force: true });
  const reg = run(["verify", root, "--baseline", base]);
  assert.equal(reg.status, 1);
  assert.match(reg.stderr, /Skills geschrumpft/);
  rmSync(root, { recursive: true, force: true });
});
