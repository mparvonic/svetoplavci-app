#!/usr/bin/env node

import { spawn } from "node:child_process";
import net from "node:net";

const localPort = Number(process.env.DB_TUNNEL_LOCAL_PORT || "5433");
const checkIntervalMs = Number(process.env.DB_TUNNEL_CHECK_INTERVAL_MS || "8000");
const restartDelayMs = Number(process.env.DB_TUNNEL_RESTART_DELAY_MS || "2000");

let shuttingDown = false;
let tunnelProcess = null;
let restartTimer = null;

function log(message) {
  console.log(`[db:tunnel:watch] ${message}`);
}

function canConnect(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // no-op
      }
      resolve(value);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

function clearRestartTimer() {
  if (!restartTimer) return;
  clearTimeout(restartTimer);
  restartTimer = null;
}

function scheduleRestart() {
  if (shuttingDown || restartTimer || tunnelProcess) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void ensureTunnel();
  }, restartDelayMs);
}

function startTunnel() {
  if (shuttingDown || tunnelProcess) return;

  log("spouštím DB tunel");
  tunnelProcess = spawn("node", ["scripts/db-tunnel.mjs"], {
    stdio: "inherit",
    env: process.env,
  });

  tunnelProcess.once("exit", (code, signal) => {
    tunnelProcess = null;
    if (shuttingDown) return;
    log(`tunel skončil (code=${code ?? "null"}, signal=${signal ?? "null"}), plánuji restart`);
    scheduleRestart();
  });
}

async function ensureTunnel() {
  if (shuttingDown) return;
  if (tunnelProcess) return;

  const healthy = await canConnect(localPort);
  if (healthy) {
    log(`tunel je dostupný na 127.0.0.1:${localPort}`);
    return;
  }

  startTunnel();
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearRestartTimer();
  log(`ukončuji watchdog (${signal})`);

  if (tunnelProcess) {
    tunnelProcess.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

log(`hlídám tunel na 127.0.0.1:${localPort} (interval ${checkIntervalMs} ms)`);
await ensureTunnel();
setInterval(() => {
  void ensureTunnel();
}, checkIntervalMs);

