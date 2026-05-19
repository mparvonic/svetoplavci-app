#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const target = args.shift();

function usage() {
  console.log(`Usage:
  node scripts/release.mjs status
  node scripts/release.mjs test --message "fix: summary" [--skip-checks] [--auto-merge]
  node scripts/release.mjs prod [--skip-checks] [--auto-merge]

Targets:
  test  Commit optional local changes, push current branch, and deploy/PR toward staging.
  prod  Promote staging to main via PR and optional auto-merge.`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...options,
  });
  if (result.status !== 0 && options.check !== false) {
    const rendered = [command, ...commandArgs].join(" ");
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }
  return result;
}

function output(command, commandArgs, options = {}) {
  const result = run(command, commandArgs, { ...options, capture: true, check: false });
  if (result.status !== 0 && options.check !== false) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

function hasFlag(name) {
  return args.includes(name);
}

function flagValue(...names) {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index !== -1) return args[index + 1] || "";
  }
  return "";
}

function requireTool(command) {
  const result = output("sh", ["-lc", `command -v ${command}`], { check: false });
  if (!result) throw new Error(`Missing required command: ${command}`);
}

function branch() {
  return output("git", ["branch", "--show-current"]);
}

function porcelain() {
  return output("git", ["status", "--porcelain=v1"]);
}

function isDirty() {
  return porcelain().length > 0;
}

function ensureClean() {
  if (isDirty()) {
    throw new Error("Working tree has uncommitted changes. Commit them or pass --message for test releases.");
  }
}

function commitIfRequested() {
  const message = flagValue("--message", "-m");
  if (!message) {
    ensureClean();
    return;
  }
  if (!isDirty()) {
    console.log("[release] No local changes to commit.");
    return;
  }
  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", message]);
}

function runChecks() {
  if (hasFlag("--skip-checks")) {
    console.log("[release] Skipping local checks by request.");
    return;
  }
  run("./scripts/release-checks.sh", []);
}

function fetch() {
  run("git", ["fetch", "origin", "staging", "main"]);
}

function ensureNoDivergence(localRef, remoteRef) {
  const remoteExists = output("git", ["rev-parse", "--verify", "--quiet", remoteRef], { check: false });
  if (!remoteExists) {
    console.log(`[release] Remote ref ${remoteRef} does not exist yet; treating ${localRef} as a new branch.`);
    return;
  }
  const localOnly = output("git", ["rev-list", "--count", `${remoteRef}..${localRef}`]);
  const remoteOnly = output("git", ["rev-list", "--count", `${localRef}..${remoteRef}`]);
  if (remoteOnly !== "0") {
    throw new Error(`${localRef} is behind ${remoteRef}. Pull/rebase before release. local-only=${localOnly}, remote-only=${remoteOnly}`);
  }
}

function ghAvailable() {
  return output("sh", ["-lc", "command -v gh"], { check: false }).length > 0;
}

function createOrShowPr(base, head, title, body) {
  if (!ghAvailable()) {
    console.log(`[release] gh is not available. Create PR manually: ${head} -> ${base}`);
    return "";
  }

  const existing = output("gh", ["pr", "list", "--base", base, "--head", head, "--state", "open", "--json", "url", "--jq", ".[0].url"], { check: false });
  if (existing) {
    console.log(`[release] Existing PR: ${existing}`);
    return existing;
  }

  const created = output("gh", ["pr", "create", "--base", base, "--head", head, "--title", title, "--body", body], { check: false });
  if (!created) {
    throw new Error(`Could not create PR ${head} -> ${base}.`);
  }
  console.log(`[release] Created PR: ${created}`);
  return created;
}

function autoMergePr(base, head) {
  if (!hasFlag("--auto-merge")) return;
  if (!ghAvailable()) throw new Error("Cannot auto-merge without gh.");

  const number = output("gh", ["pr", "list", "--base", base, "--head", head, "--state", "open", "--json", "number", "--jq", ".[0].number"], { check: false });
  if (!number) throw new Error(`No open PR found for ${head} -> ${base}.`);
  run("gh", ["pr", "merge", number, "--merge", "--auto", "--delete-branch=false"]);
}

function status() {
  run("git", ["status", "--short", "--branch"]);
  console.log("");
  console.log("Release commands:");
  console.log("- npm run release:test -- --message \"fix: summary\"");
  console.log("- npm run release:prod");
  console.log("- npm run release:prod -- --auto-merge");
}

function releaseTest() {
  requireTool("git");
  commitIfRequested();
  runChecks();
  fetch();

  const current = branch();
  ensureNoDivergence(current, `origin/${current}`);
  run("git", ["push", "-u", "origin", current]);

  if (current === "staging") {
    console.log("[release] Pushed staging. GitHub Actions will build :staging and trigger Coolify test deploy.");
    return;
  }

  if (current === "main") {
    throw new Error("Refusing to use main as a test release branch. Use staging or a feature/fix branch.");
  }

  createOrShowPr(
    "staging",
    current,
    `Merge ${current} to staging`,
    "Automated test release PR created by scripts/release.mjs.",
  );
  autoMergePr("staging", current);
  console.log("[release] Test deploy happens after the PR reaches staging.");
}

function releaseProd() {
  requireTool("git");
  ensureClean();
  runChecks();
  fetch();

  const current = branch();
  if (current !== "staging") {
    throw new Error("Production release must be run from staging.");
  }

  ensureNoDivergence("staging", "origin/staging");
  run("git", ["push", "origin", "staging"]);

  createOrShowPr(
    "main",
    "staging",
    "Release staging to production",
    "Automated production release PR created by scripts/release.mjs.",
  );
  autoMergePr("main", "staging");
  console.log("[release] Production deploy happens after staging is merged into main.");
}

try {
  if (!target || hasFlag("--help") || target === "help") {
    usage();
  } else if (target === "status") {
    status();
  } else if (target === "test") {
    releaseTest();
  } else if (target === "prod") {
    releaseProd();
  } else {
    usage();
    process.exit(1);
  }
} catch (error) {
  console.error(`[release] ${error.message}`);
  process.exit(1);
}
