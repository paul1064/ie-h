#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditFusion } from "./fuse-audit.mjs";

test("fuse-audit bestätigt vollständige Übernahme und meldet fehlende Skills/Skripte", () => {
  const root = mkdtempSync(join(tmpdir(), "fuse-"));
  const a = join(root, "repo-a"), b = join(root, "repo-b"), t = join(root, "target");
  mkdirSync(join(a, ".claude/skills/s1/scripts"), { recursive: true });
  writeFileSync(join(a, ".claude/skills/s1/SKILL.md"), "---\nname: s1\ndescription: 1\n---\n");
  writeFileSync(join(a, ".claude/skills/s1/scripts/x.mjs"), "export default 1;\n");

  mkdirSync(join(b, "skills/s2"), { recursive: true });
  writeFileSync(join(b, "skills/s2/SKILL.md"), "---\nname: s2\ndescription: 2\n---\n");

  mkdirSync(join(t, ".claude/skills/s1/scripts"), { recursive: true });
  writeFileSync(join(t, ".claude/skills/s1/SKILL.md"), "---\nname: s1\ndescription: 1\n---\n");
  writeFileSync(join(t, ".claude/skills/s1/scripts/x.mjs"), "export default 1;\n");

  const miss = auditFusion({ sources: [a, b], target: t });
  assert.equal(miss.problems.length, 1);
  assert.match(miss.problems[0], /s2/);

  mkdirSync(join(t, ".claude/skills/s2"), { recursive: true });
  writeFileSync(join(t, ".claude/skills/s2/SKILL.md"), "---\nname: s2\ndescription: 2\n---\n");
  const ok = auditFusion({ sources: [a, b], target: t });
  assert.deepEqual(ok.problems, []);
  rmSync(root, { recursive: true, force: true });
});
