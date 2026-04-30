#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";

const sshHost = process.env.DB_TUNNEL_SSH_HOST || "vps";
const localPort = process.env.DB_TUNNEL_LOCAL_PORT || "5433";
const proxyContainer = process.env.DB_TUNNEL_PROXY_CONTAINER || "svetoplavci-auth-db-proxy";
const proxyNetwork = process.env.DB_TUNNEL_PROXY_NETWORK || "edge_net";

function fail(message, error) {
  console.error(`[db:tunnel] ${message}`);
  if (error) console.error(error);
  process.exit(1);
}

const inspect = spawnSync(
  "ssh",
  [
    "-o",
    "BatchMode=yes",
    sshHost,
    `docker inspect -f '{{(index .NetworkSettings.Networks "${proxyNetwork}").IPAddress}}' ${proxyContainer}`,
  ],
  { encoding: "utf8" },
);

if (inspect.status !== 0) {
  fail(`Nepodařilo se zjistit IP kontejneru ${proxyContainer} na ${sshHost}.`, inspect.stderr.trim());
}

const remoteHost = inspect.stdout.trim();
if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(remoteHost)) {
  fail(`Neplatná IP adresa DB proxy: ${remoteHost || "(prázdná)"}`);
}

console.log(`[db:tunnel] localhost:${localPort} -> ${sshHost}:${remoteHost}:5432`);

const tunnel = spawn(
  "ssh",
  [
    "-N",
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `${localPort}:${remoteHost}:5432`,
    sshHost,
  ],
  { stdio: "inherit" },
);

tunnel.on("exit", (code, signal) => {
  if (signal) process.exit(128);
  process.exit(code ?? 0);
});
