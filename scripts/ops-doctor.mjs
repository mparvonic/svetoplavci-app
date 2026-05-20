#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const repoLocalPath = "/Users/miroslav/Projects/gx10/srv/projects/svetoplavci-app";
const gx10Path = "/srv/projects/svetoplavci-app";
const macMountedEnvPath = "/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local";
const gx10EnvPath = "/data/projects/svetoplavci-app/secrets/env.local";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function ok(label, detail = "") {
  console.log(`OK   ${label}${detail ? `: ${detail}` : ""}`);
}

function warn(label, detail = "") {
  console.log(`WARN ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.log(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fileExists(candidate)) || "";
}

function commandExists(command) {
  const result = run("sh", ["-lc", `command -v ${command}`]);
  return result.status === 0;
}

function canConnect(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

function sshCheck(host) {
  if (!commandExists("ssh")) return { ok: false, detail: "ssh command is missing" };
  const result = run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=4", host, "printf ok"]);
  return {
    ok: result.status === 0 && result.stdout.trim() === "ok",
    detail: (result.stderr || result.stdout || "").trim(),
  };
}

function runningNextCommand(cwd) {
  const result = run("ps", ["-axo", "command="]);
  if (result.status !== 0) return "";
  return result.stdout
    .split("\n")
    .find((line) => line.includes("next dev") && line.includes(cwd) && !line.includes("grep")) || "";
}

function portFromNextCommand(command, fallbackPort) {
  const match = command.match(/(?:--port|-p)(?:=| )([0-9]+)/);
  return match ? Number(match[1]) : fallbackPort;
}

function gitOutput(args) {
  const result = run("git", args);
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

async function main() {
  const cwd = process.cwd();
  const isMac = os.platform() === "darwin";
  const localEnvPath = path.join(cwd, ".env.local");
  const runtimeEnv = firstExisting([localEnvPath, gx10EnvPath, macMountedEnvPath]);
  const dbPort = Number(process.env.DB_TUNNEL_LOCAL_PORT || "5433");
  const devPort = Number(process.env.PORT || "3000");

  console.log("Svetoplavci operational doctor");
  console.log(`cwd: ${cwd}`);
  console.log(`platform: ${os.platform()} ${os.arch()}`);
  console.log("");

  if (cwd === repoLocalPath || cwd.startsWith(`${repoLocalPath}/`)) {
    ok("repo path", "Mac NFS mount of GX10 project");
  } else if (cwd === gx10Path || cwd.startsWith(`${gx10Path}/`)) {
    ok("repo path", "native GX10 checkout");
  } else {
    warn("repo path", "not the documented Mac mount or GX10 canonical path");
  }

  if (isMac) {
    const mountResult = run("sh", ["-lc", "mount | grep '/Users/miroslav/Projects/gx10'"]);
    if (mountResult.status === 0) {
      ok("GX10 mount", mountResult.stdout.trim().split("\n")[0]);
    } else {
      fail("GX10 mount", "mount /Users/miroslav/Projects/gx10 is not visible");
    }
  }

  if (runtimeEnv) {
    ok("runtime env", runtimeEnv === localEnvPath ? ".env.local" : runtimeEnv);
  } else {
    fail("runtime env", "missing .env.local and GX10 mounted /data secrets env");
  }

  if (fileExists(path.join(cwd, "node_modules", ".package-lock.json"))) {
    ok("dependencies", "node_modules present");
  } else if (fileExists(path.join(cwd, "node_modules"))) {
    warn("dependencies", "node_modules present but npm metadata missing");
  } else {
    fail("dependencies", "run npm ci or npm run dev:up");
  }

  const gx10 = sshCheck("gx10");
  if (gx10.ok) ok("ssh gx10", "reachable");
  else warn("ssh gx10", gx10.detail || "not reachable");

  const vps = sshCheck("vps");
  if (vps.ok) ok("ssh vps", "reachable");
  else warn("ssh vps", vps.detail || "not reachable");

  const dbOpen = await canConnect("127.0.0.1", dbPort);
  if (dbOpen) ok("DB tunnel", `127.0.0.1:${dbPort}`);
  else warn("DB tunnel", `127.0.0.1:${dbPort} is closed; npm run dev:up will start watchdog`);

  const nextCommand = runningNextCommand(cwd);
  if (nextCommand) {
    const nextPort = portFromNextCommand(nextCommand, devPort);
    ok("Next dev", `http://127.0.0.1:${nextPort}`);
  } else {
    const devOpen = await canConnect("127.0.0.1", devPort);
    if (devOpen) warn("Next dev", `${devPort} is busy, but no Next dev process was found for this checkout`);
    else warn("Next dev", `not listening on ${devPort}; npm run dev:up will start it`);
  }

  const branch = gitOutput(["branch", "--show-current"]);
  const status = gitOutput(["status", "--short", "--branch"]);
  if (branch) ok("git branch", branch);
  if (status) console.log(`git status: ${status.replace(/\n/g, " | ")}`);

  console.log("");
  console.log("Standard commands:");
  console.log("- npm run dev:up");
  console.log("- npm run release:test -- --message \"type: summary\"");
  console.log("- npm run release:prod");
  console.log("- npm run release:hotfix -- --message \"fix: summary\"");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
