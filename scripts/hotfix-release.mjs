#!/usr/bin/env node

import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const originalCwd = process.cwd();
const macGx10Prefix = "/Users/miroslav/Projects/gx10";
const args = process.argv.slice(2);
const target = args.shift();
let releaseCwd = originalCwd;
let releaseWorktree = "";
let releaseSha = "";

function usage() {
  console.log(`Usage:
  node scripts/hotfix-release.mjs status
  node scripts/hotfix-release.mjs test --message "fix: summary" [--include-all] [--precheck]
  node scripts/hotfix-release.mjs prod --message "fix: summary" [--include-all] [--precheck] [--skip-test-gate]
  node scripts/hotfix-release.mjs both --message "fix: summary" [--include-all] [--precheck]

Targets:
  test    Commit staged changes in an isolated worktree, build/push :staging on GX10, trigger test deploy hook.
  prod    Commit staged changes in an isolated worktree, build/push :latest on GX10, trigger prod deploy hook.
  both    Commit staged changes in an isolated worktree, build once on GX10, push :staging and :latest, trigger both hooks.

Environment:
  HOTFIX_DEPLOY_MODE                            image (default) or git
  HOTFIX_GX10_HOST                              default: gx10
  HOTFIX_GX10_REPO_PATH                         default: /srv/projects/svetoplavci-app
  HOTFIX_GX10_BUILD_ROOT                        default: /data/tmp/svetoplavci/hotfix-image-builds
  HOTFIX_BUNDLE_DIR                             default: /data/projects/svetoplavci-app/hotfix-bundles
  HOTFIX_IMAGE_NAME                             default: ghcr.io/mparvonic/svetoplavci-app
  HOTFIX_GHCR_USER                              default: mparvonic
  HOTFIX_GHCR_TOKEN                             required for image mode
  HOTFIX_DOCKER_POSTGRES_PRISMA_URL             optional build-time Prisma URL, falls back to POSTGRES_PRISMA_URL
  HOTFIX_TEST_REMOTE / HOTFIX_PROD_REMOTE       default: origin
  HOTFIX_TEST_BRANCH / HOTFIX_PROD_BRANCH       default: staging / main
  HOTFIX_TEST_DEPLOY_WEBHOOK                    preferred test deploy hook
  HOTFIX_PROD_DEPLOY_WEBHOOK                    preferred prod deploy hook
  COOLIFY_TEST_DEPLOY_WEBHOOK                   fallback test deploy hook
  COOLIFY_PROD_DEPLOY_WEBHOOK                   fallback prod deploy hook
  HOTFIX_DEPLOY_AUTH_BEARER / COOLIFY_API_TOKEN optional Bearer token for deploy hooks
  HOTFIX_ENV_FILE                               optional env file with hotfix secrets
  HOTFIX_AUDIT_LOG                              JSONL audit log path, default .tmp/hotfix-audit.jsonl
  HOTFIX_WORKTREE_ROOT                          temporary worktree parent directory`);
}

function defaultEnvFiles() {
  const candidates = [
    process.env.HOTFIX_ENV_FILE,
    path.join(originalCwd, ".env.local"),
    "/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local",
    "/data/projects/svetoplavci-app/secrets/env.local",
  ];
  return candidates.filter(Boolean);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const envFile of defaultEnvFiles()) {
  loadEnvFile(envFile);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? originalCwd,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...options,
  });
  if (result.status !== 0 && options.check !== false) {
    throw new Error(`Command failed (${result.status}): ${[command, ...commandArgs].join(" ")}`);
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

function rawOutput(command, commandArgs, options = {}) {
  const result = run(command, commandArgs, { ...options, capture: true, check: false });
  if (result.status !== 0 && options.check !== false) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout;
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
  const found = output("sh", ["-lc", `command -v ${command}`], { check: false });
  if (!found) throw new Error(`Missing required command: ${command}`);
}

function git(argsForGit, options = {}) {
  return run("git", argsForGit, { cwd: options.cwd ?? releaseCwd, ...options });
}

function gitOutput(argsForGit, options = {}) {
  return output("git", argsForGit, { cwd: options.cwd ?? releaseCwd, ...options });
}

function remoteFor(kind) {
  return flagValue(`--${kind}-remote`, "--remote") || process.env[`HOTFIX_${kind.toUpperCase()}_REMOTE`] || "origin";
}

function branchFor(kind) {
  const fallback = kind === "test" ? "staging" : "main";
  return flagValue(`--${kind}-branch`, "--branch") || process.env[`HOTFIX_${kind.toUpperCase()}_BRANCH`] || fallback;
}

function deployHookFor(kind) {
  return (
    flagValue(`--${kind}-deploy-hook`, "--deploy-hook") ||
    process.env[`HOTFIX_${kind.toUpperCase()}_DEPLOY_WEBHOOK`] ||
    process.env[`COOLIFY_${kind.toUpperCase()}_DEPLOY_WEBHOOK`] ||
    ""
  );
}

function deployAuthBearer() {
  return process.env.HOTFIX_DEPLOY_AUTH_BEARER || process.env.COOLIFY_API_TOKEN || "";
}

function deployMode() {
  return (flagValue("--mode") || process.env.HOTFIX_DEPLOY_MODE || "image").toLowerCase();
}

function gx10Host() {
  return flagValue("--gx10-host") || process.env.HOTFIX_GX10_HOST || "gx10";
}

function gx10RepoPath() {
  return flagValue("--gx10-repo") || process.env.HOTFIX_GX10_REPO_PATH || "/srv/projects/svetoplavci-app";
}

function gx10BuildRoot() {
  return process.env.HOTFIX_GX10_BUILD_ROOT || "/data/tmp/svetoplavci/hotfix-image-builds";
}

function bundleDir() {
  return process.env.HOTFIX_BUNDLE_DIR || "/data/projects/svetoplavci-app/hotfix-bundles";
}

function hotfixImageName() {
  return process.env.HOTFIX_IMAGE_NAME || "ghcr.io/mparvonic/svetoplavci-app";
}

function hotfixGhcrUser() {
  return process.env.HOTFIX_GHCR_USER || "mparvonic";
}

function remoteEnvFile() {
  if (process.env.HOTFIX_ENV_FILE?.startsWith("/data/")) return process.env.HOTFIX_ENV_FILE;
  return "/data/projects/svetoplavci-app/secrets/env.local";
}

function shortSha() {
  return gitOutput(["rev-parse", "--short", "HEAD"]);
}

function fullSha() {
  return gitOutput(["rev-parse", "HEAD"]);
}

function hasStagedChanges() {
  return run("git", ["diff", "--cached", "--quiet"], { cwd: originalCwd, check: false }).status !== 0;
}

function isInMergeState() {
  return output("git", ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { cwd: originalCwd, check: false }).length > 0;
}

function auditLogPath() {
  return process.env.HOTFIX_AUDIT_LOG || path.join(originalCwd, ".tmp", "hotfix-audit.jsonl");
}

function writeAudit(entry) {
  const payload = {
    timestamp: new Date().toISOString(),
    actor: output("git", ["config", "user.email"], { cwd: originalCwd, check: false }) || null,
    ...entry,
  };
  const logPath = auditLogPath();
  run("mkdir", ["-p", path.dirname(logPath)], { capture: true });
  appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf8");
}

function worktreeRoot() {
  if (process.env.HOTFIX_WORKTREE_ROOT) return process.env.HOTFIX_WORKTREE_ROOT;
  if (originalCwd.startsWith(`${macGx10Prefix}/`)) return path.join(path.dirname(originalCwd), ".hotfix-worktrees");
  if (originalCwd === "/srv/projects/svetoplavci-app") return "/data/tmp/svetoplavci/hotfix-worktrees";
  return path.join(tmpdir(), "svetoplavci-hotfix-worktrees");
}

function gx10PathForMacMount(localPath) {
  if (!localPath.startsWith(`${macGx10Prefix}/`)) return "";
  return localPath.replace(macGx10Prefix, "");
}

function createReleaseWorktree() {
  run("mkdir", ["-p", worktreeRoot()], { capture: true });
  releaseWorktree = mkdtempSync(path.join(worktreeRoot(), "hotfix-"));
  rmSync(releaseWorktree, { recursive: true, force: true });
  const base = output("git", ["rev-parse", "HEAD"], { cwd: originalCwd });
  run("git", ["worktree", "add", "--detach", releaseWorktree, base], { cwd: originalCwd });
  releaseCwd = releaseWorktree;
}

function cleanupReleaseWorktree() {
  if (!releaseWorktree || hasFlag("--keep-worktree")) return;
  run("git", ["worktree", "remove", "--force", releaseWorktree], { cwd: originalCwd, check: false, capture: true });
  rmSync(releaseWorktree, { recursive: true, force: true });
}

function prepareReleaseCommit() {
  const message = flagValue("--message", "-m");
  if (hasFlag("--include-all")) {
    run("git", ["add", "-A"], { cwd: originalCwd });
  }

  createReleaseWorktree();

  if (!hasStagedChanges()) {
    if (message) console.log("[hotfix] No staged changes to commit; releasing current HEAD from isolated worktree.");
    releaseSha = fullSha();
    return;
  }

  if (!message) {
    throw new Error("Staged changes are present. Commit them with --message or unstage them before hotfix release.");
  }

  const patch = rawOutput("git", ["diff", "--cached", "--binary", "--full-index", "--unified=8"], { cwd: originalCwd });
  const patchPath = path.join(releaseCwd, ".hotfix-staged.patch");
  writeFileSync(patchPath, patch, "utf8");
  git(["apply", "--index", "--binary", patchPath]);
  git(["commit", "-m", message]);
  releaseSha = fullSha();
}

function runChecksOnce() {
  if (hasFlag("--skip-checks")) {
    console.log("[hotfix] Skipping checks by request.");
    return;
  }
  const gx10WorktreePath = gx10PathForMacMount(releaseCwd);
  const isMacGx10Worktree = releaseCwd.startsWith(`${macGx10Prefix}/`);
  run("./scripts/release-checks.sh", [], {
    cwd: releaseCwd,
    env: {
      ...process.env,
      ...(isMacGx10Worktree
        ? {
            GX10_CLEAN_CHECKS: "1",
            GX10_RELEASE_TMP_ROOT: path.join(macGx10Prefix, "data/tmp/svetoplavci/release-checks"),
            GX10_ENV_FILE: path.join(macGx10Prefix, "data/projects/svetoplavci-app/secrets/env.local"),
          }
        : {}),
      ...(gx10WorktreePath ? { GX10_REPO_PATH: gx10WorktreePath } : {}),
      GX10_REUSE_CHECKOUT: process.env.GX10_REUSE_CHECKOUT || "1",
    },
  });
}

function fetchTarget(kind) {
  const remote = remoteFor(kind);
  const branch = branchFor(kind);
  git(["fetch", remote, branch]);
}

function targetRef(kind) {
  return `${remoteFor(kind)}/${branchFor(kind)}`;
}

function alignWithTarget(kind) {
  fetchTarget(kind);
  const ref = targetRef(kind);
  const status = git(["merge-base", "--is-ancestor", ref, "HEAD"], { check: false }).status;
  if (status === 0) return;

  const mergeBase = gitOutput(["merge-base", ref, "HEAD"]);
  const commits = gitOutput(["rev-list", "--reverse", `${mergeBase}..HEAD`])
    .split("\n")
    .map((commit) => commit.trim())
    .filter(Boolean);
  if (commits.length === 0) {
    git(["checkout", "--detach", ref]);
    releaseSha = fullSha();
    return;
  }

  console.log(`[hotfix] Rebasing hotfix commits onto ${ref} so ${kind} push is fast-forward.`);
  git(["checkout", "--detach", ref]);
  git(["cherry-pick", ...commits]);
  releaseSha = fullSha();
}

function ensureRemoteContainsHead(kind) {
  const remote = remoteFor(kind);
  const branch = branchFor(kind);
  const remoteRef = targetRef(kind);
  const exists = gitOutput(["rev-parse", "--verify", "--quiet", remoteRef], { check: false });
  if (!exists) {
    throw new Error(`Cannot verify ${remoteRef}. Push to ${kind} first or use --skip-test-gate for production.`);
  }

  const status = git(["merge-base", "--is-ancestor", "HEAD", remoteRef], { check: false }).status;
  if (status !== 0) {
    throw new Error(`HEAD ${shortSha()} is not present on ${remoteRef}. Release test first or use --skip-test-gate.`);
  }
}

function pushTarget(kind) {
  const remote = remoteFor(kind);
  const branch = branchFor(kind);
  console.log(`[hotfix] Pushing ${shortSha()} to ${remote}/${branch}.`);
  git(["push", remote, `HEAD:${branch}`]);
  return { remote, branch };
}

async function triggerDeploy(kind) {
  const hook = deployHookFor(kind);
  if (!hook) {
    if (hasFlag("--require-deploy-hook")) {
      throw new Error(`Missing ${kind} deploy hook. Set HOTFIX_${kind.toUpperCase()}_DEPLOY_WEBHOOK.`);
    }
    console.log(`[hotfix] No ${kind} deploy hook configured; assuming remote push triggers deploy.`);
    return { configured: false, ok: true, status: null };
  }

  console.log(`[hotfix] Triggering ${kind} deploy hook.`);
  const headers = {};
  const bearer = deployAuthBearer();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const response = await fetch(hook, { method: "POST", headers });
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`${kind} deploy hook failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return { configured: true, ok: true, status: response.status };
}

async function release(kind, options = {}) {
  if (kind === "prod") {
    fetchTarget("test");
    if (!hasFlag("--skip-test-gate") && !options.skipTestGate) ensureRemoteContainsHead("test");
  }

  fetchTarget(kind);
  const push = pushTarget(kind);
  const deploy = await triggerDeploy(kind);
  return { kind, ...push, deploy };
}

function shQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function dockerTagsFor(kinds) {
  const image = hotfixImageName();
  const tags = [];
  if (kinds.includes("test")) tags.push(`${image}:staging`);
  if (kinds.includes("prod")) {
    tags.push(`${image}:latest`);
    tags.push(`${image}:sha-${releaseSha.slice(0, 7)}`);
  }
  return [...new Set(tags)];
}

function remoteImageBuildScript(tags) {
  const tagArgs = tags.map((tag) => `-t ${shQuote(tag)}`).join(" ");
  const pushCommands = tags.map((tag) => `docker push ${shQuote(tag)}`).join("\n");
  const bundlePath = `${bundleDir().replace(/\/$/, "")}/${releaseSha}.bundle`;

  return `set -euo pipefail
set +x

ENV_FILE=${shQuote(remoteEnvFile())}
REPO=${shQuote(gx10RepoPath())}
BUILD_ROOT=${shQuote(gx10BuildRoot())}
BUILD_DIR="$BUILD_ROOT/${releaseSha}"
BUNDLE_DIR=${shQuote(bundleDir())}
BUNDLE_PATH=${shQuote(bundlePath)}
SHA=${shQuote(releaseSha)}
IMAGE=${shQuote(hotfixImageName())}
GHCR_USER_DEFAULT=${shQuote(hotfixGhcrUser())}

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

: "\${HOTFIX_GHCR_TOKEN:?Missing HOTFIX_GHCR_TOKEN in $ENV_FILE or environment. Create a GitHub token with write:packages for GHCR pushes.}"
GHCR_USER="\${HOTFIX_GHCR_USER:-$GHCR_USER_DEFAULT}"
POSTGRES_URL="\${HOTFIX_DOCKER_POSTGRES_PRISMA_URL:-\${POSTGRES_PRISMA_URL:-}}"
: "\${POSTGRES_URL:?Missing HOTFIX_DOCKER_POSTGRES_PRISMA_URL or POSTGRES_PRISMA_URL for Docker build.}"

mkdir -p "$BUILD_ROOT" "$BUNDLE_DIR"
cleanup() {
  git -C "$REPO" worktree remove --force "$BUILD_DIR" >/dev/null 2>&1 || rm -rf "$BUILD_DIR"
}
trap cleanup EXIT
cleanup

git -C "$REPO" worktree add --detach "$BUILD_DIR" "$SHA"
git -C "$REPO" bundle create "$BUNDLE_PATH" "$SHA^..$SHA" >/dev/null 2>&1 || git -C "$REPO" bundle create "$BUNDLE_PATH" "$SHA" >/dev/null

cd "$BUILD_DIR"
printf '%s' "$HOTFIX_GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
export DOCKER_BUILDKIT=1
docker build \\
  --build-arg POSTGRES_PRISMA_URL="$POSTGRES_URL" \\
  --build-arg RUN_PRISMA_DB_PUSH=0 \\
  --build-arg NEXT_DEPLOYMENT_ID="$SHA" \\
  ${tagArgs} \\
  .
${pushCommands}
docker logout ghcr.io >/dev/null 2>&1 || true
echo "[hotfix] Image build completed for $SHA"
echo "[hotfix] Audit bundle: $BUNDLE_PATH"
`;
}

function runRemoteImageBuild(tags) {
  const host = gx10Host();
  console.log(`[hotfix] Building Docker image once on ${host}: ${tags.join(", ")}`);
  const script = remoteImageBuildScript(tags);
  const command = host === "local" ? "bash" : "ssh";
  const commandArgs = host === "local" ? ["-se"] : [host, "bash -se"];
  const result = spawnSync(command, commandArgs, {
    cwd: originalCwd,
    input: script,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(`Image build/push failed on ${host}.`);
  }
}

async function imageRelease(kinds) {
  const tags = dockerTagsFor(kinds);
  runRemoteImageBuild(tags);
  const releases = [];
  for (const kind of kinds) {
    const deploy = await triggerDeploy(kind);
    releases.push({
      kind,
      image: hotfixImageName(),
      tags: dockerTagsFor([kind]).map((tag) => tag.slice(`${hotfixImageName()}:`.length)),
      deploy,
    });
  }
  return releases;
}

function status() {
  run("git", ["status", "--short", "--branch"], { cwd: originalCwd });
  console.log("");
  console.log("Hotfix configuration:");
  console.log(`- deploy mode: ${deployMode()}`);
  console.log(`- image: ${hotfixImageName()}`);
  console.log(`- gx10 host: ${gx10Host()}`);
  console.log(`- gx10 repo: ${gx10RepoPath()}`);
  console.log(`- ghcr user: ${hotfixGhcrUser()}`);
  console.log(`- ghcr token: ${process.env.HOTFIX_GHCR_TOKEN ? "configured" : "not configured"}`);
  for (const kind of ["test", "prod"]) {
    const hook = deployHookFor(kind);
    console.log(`- ${kind}: ${remoteFor(kind)}/${branchFor(kind)} deployHook=${hook ? "configured" : "not configured"}`);
  }
  console.log(`- deploy auth bearer: ${deployAuthBearer() ? "configured" : "not configured"}`);
  console.log(`- audit log: ${auditLogPath()}`);
  console.log("");
  console.log("Hotfix commands:");
  console.log("- git add <exact files>");
  console.log("- npm run release:hotfix -- --message \"fix: summary\"");
  console.log("- npm run hotfix:prod -- --message \"fix: summary\" --skip-test-gate");
  console.log("- npm run release:hotfix -- --mode git --message \"fix: summary\" # fallback through protected branches");
}

try {
  if (!target || hasFlag("--help") || target === "help") {
    usage();
  } else if (target === "status") {
    status();
  } else {
    requireTool("git");
    if (isInMergeState()) throw new Error("Repository is in a merge state. Finish or abort the merge before hotfix release.");
    prepareReleaseCommit();
    const mode = deployMode();
    if (!["image", "git"].includes(mode)) throw new Error(`Unsupported hotfix deploy mode: ${mode}`);
    if (target === "prod" || target === "both") alignWithTarget("prod");
    if (hasFlag("--precheck")) runChecksOnce();

    let releases = [];
    if (mode === "image") {
      if (target === "test") releases = await imageRelease(["test"]);
      else if (target === "prod") releases = await imageRelease(["prod"]);
      else if (target === "both") releases = await imageRelease(["test", "prod"]);
      else {
        usage();
        process.exit(1);
      }
    } else if (target === "test") {
      runChecksOnce();
      releases.push(await release("test"));
    } else if (target === "prod") {
      runChecksOnce();
      releases.push(await release("prod"));
    } else if (target === "both") {
      runChecksOnce();
      releases.push(await release("test"));
      releases.push(await release("prod", { skipTestGate: true }));
    } else {
      usage();
      process.exit(1);
    }

    writeAudit({
      status: "success",
      commandTarget: target,
      deployMode: mode,
      commit: releaseSha || fullSha(),
      shortCommit: shortSha(),
      message: flagValue("--message", "-m") || null,
      skipChecks: hasFlag("--skip-checks"),
      skipTestGate: hasFlag("--skip-test-gate"),
      releases,
    });
    console.log(`[hotfix] Done at ${shortSha()}.`);
  }
} catch (error) {
  writeAudit({
    status: "failure",
    commandTarget: target || null,
    commit: releaseSha || output("git", ["rev-parse", "HEAD"], { cwd: releaseCwd, check: false }) || null,
    message: flagValue("--message", "-m") || null,
    error: error.message,
  });
  console.error(`[hotfix] ${error.message}`);
  process.exitCode = 1;
} finally {
  cleanupReleaseWorktree();
}
