#!/usr/bin/env node
// PreToolUse(Bash) hook: gate every `git commit`.
// Blocks (exit 2) unless ALL of the following hold:
//   1. the commit subject is a valid Conventional Commit
//   2. `npm run lint` passes (Biome)        — if the script exists
//   3. `npm run typecheck` passes (tsc)      — if the script exists
// Only runs for actual `git commit` commands; everything else passes through.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const TYPES = [
  "feat", "fix", "test", "refactor", "build",
  "chore", "docs", "style", "perf", "ci", "revert",
];
const PATTERN = new RegExp(
  `^(${TYPES.join("|")})(\\([a-z0-9\\-]+\\))?!?: .{1,72}$`
);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

function extractMessage(cmd) {
  const m = cmd.match(/-[a-zA-Z]*m\s+("([^"]*)"|'([^']*)'|([^\s]+))/);
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function block(reason) {
  process.stderr.write("COMMIT BLOCKED — " + reason + "\n");
  process.exit(2);
}

function hasScript(name) {
  try {
    if (!existsSync("package.json")) return false;
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    return Boolean(pkg.scripts && pkg.scripts[name]);
  } catch {
    return false;
  }
}

function runScript(name) {
  // Returns { ok, output }. Skips silently if the script isn't defined yet
  // (so the very first scaffolding commit isn't blocked before tooling exists).
  if (!hasScript(name)) return { ok: true, output: "(skipped: no script)" };
  try {
    execSync(`npm run ${name}`, { stdio: "pipe", encoding: "utf8" });
    return { ok: true, output: "" };
  } catch (e) {
    const out = `${e.stdout || ""}\n${e.stderr || ""}`.trim();
    return { ok: false, output: out };
  }
}

(async () => {
  let input = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }

  const cmd = input?.tool_input?.command ?? "";
  if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0);

  // 1) Conventional Commit message
  const msg = extractMessage(cmd);
  if (msg !== null) {
    const subject = msg.split("\n")[0].trim();
    if (!PATTERN.test(subject)) {
      block(
        `commit message is not a valid Conventional Commit.\n` +
          `  Got:    "${subject}"\n` +
          `  Format: type(scope): subject   (scope optional, subject <=72 chars)\n` +
          `  Types:  ${TYPES.join(", ")}\n` +
          `  Example: feat(redirect): add URL redirect rule with regex substitution`
      );
    }
  }

  // 2) Lint  3) Type-check — must both pass
  const lint = runScript("lint");
  if (!lint.ok) {
    block(`\`npm run lint\` failed. Fix lint errors before committing.\n${lint.output}`);
  }
  const types = runScript("typecheck");
  if (!types.ok) {
    block(`\`npm run typecheck\` failed. Fix type errors before committing.\n${types.output}`);
  }

  process.exit(0); // all gates passed → allow the commit
})();
