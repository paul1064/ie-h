#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initSkillDir, lintSkillDir } from "./scaffold.mjs";

test("scaffold init legt validen Skill mit Invarianten-Block an; lint besteht mit 0 Fehlern", () => {
  const root = mkdtempSync(join(tmpdir(), "wsc-"));
  const dir = join(root, "demo-skill");
  initSkillDir(dir, "Prüft einen Beispielablauf zuverlässig.");
  assert.deepEqual(lintSkillDir(dir), []);
  rmSync(root, { recursive: true, force: true });
});

test("scaffold lint erkennt fehlenden Invarianten-Block und Hygiene-Verstöße", () => {
  const root = mkdtempSync(join(tmpdir(), "wsc-bad-"));
  const dir = join(root, "bad-skill");
  initSkillDir(dir, "Kurzbeschreibung");
  const banned = ["chem", "istry"].join("");
  writeFileSync(join(dir, "SKILL.md"), `---\nname: wrong-name\ndescription: Test\n---\n\nVerbotenes Wort: ${banned}\n`);
  const errs = lintSkillDir(dir);
  assert.ok(errs.some((e) => e.includes("!= Ordner")));
  assert.ok(errs.some((e) => e.includes("Invarianten-Block")));
  assert.ok(errs.some((e) => e.includes("Hygiene-Verstoß")));
  rmSync(root, { recursive: true, force: true });
});
