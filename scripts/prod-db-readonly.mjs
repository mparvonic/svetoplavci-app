#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import { Client } from "pg";

const mode = process.argv[2] || "doctor";
const modeArgs = process.argv.slice(3);

const vpsHost = process.env.PROD_DB_VPS_HOST || "vps";
const proxyContainer = process.env.PROD_DB_PROXY_CONTAINER || "svetoplavci-auth-db-proxy";
const proxyNetwork = process.env.PROD_DB_PROXY_NETWORK || "edge_net";
const localPort = Number(process.env.PROD_DB_LOCAL_PORT || "5544");
const expectedDatabase = process.env.PROD_DB_EXPECTED_DATABASE || "svetoplavci";
const appImage = process.env.PROD_DB_APP_IMAGE || "ghcr.io/mparvonic/svetoplavci-app:latest";
const appContainerCandidates = (process.env.PROD_DB_APP_CONTAINERS || "j13574gml256ob8bv8mszgug-213732343302,svetoplavci-app")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

let tunnelProcess = null;
let closingTunnel = false;

function fail(message, detail) {
  console.error(`[prod:db:readonly] ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function log(message) {
  console.error(`[prod:db:readonly] ${message}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function ssh(command) {
  const result = run("ssh", ["-o", "BatchMode=yes", vpsHost, command]);
  if (result.status !== 0) {
    fail(`SSH command failed on ${vpsHost}.`, result.stderr.trim() || result.stdout.trim());
  }
  return result.stdout.trim();
}

function commandExists(command) {
  return run("sh", ["-lc", `command -v ${command}`]).status === 0;
}

function canConnect(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
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

function parseContainerEnv(raw) {
  const env = new Map();
  for (const line of raw.split("\n")) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    env.set(line.slice(0, index), line.slice(index + 1));
  }
  return env;
}

function findProductionAppContainer() {
  const ps = ssh(`docker ps --format '{{.Names}} {{.Image}}'`);
  const imageMatch = ps
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === appImage);
  if (imageMatch?.[0]) return imageMatch[0];

  for (const candidate of appContainerCandidates) {
    const inspect = run("ssh", ["-o", "BatchMode=yes", vpsHost, `docker inspect ${candidate} >/dev/null 2>&1`]);
    if (inspect.status === 0) return candidate;
  }

  fail(`Could not find production app container for image ${appImage}.`);
}

function loadProductionDbUrl(containerName) {
  const rawEnv = ssh(`docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' ${containerName}`);
  const env = parseContainerEnv(rawEnv);
  const rawUrl = env.get("POSTGRES_PRISMA_URL") || env.get("DATABASE_URL");
  if (!rawUrl) fail(`Production container ${containerName} has no POSTGRES_PRISMA_URL/DATABASE_URL.`);

  let url;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    fail("Production database URL is not a valid URL.", String(error));
  }

  const database = url.pathname.replace(/^\//, "");
  if (database !== expectedDatabase) {
    fail(`Refusing to use database "${database}". Expected production database "${expectedDatabase}".`);
  }

  return { rawUrl, database, containerName };
}

function loadProxyHost() {
  const remoteHost = ssh(`docker inspect -f '{{(index .NetworkSettings.Networks "${proxyNetwork}").IPAddress}}' ${proxyContainer}`);
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(remoteHost)) {
    fail(`Invalid DB proxy IP for ${proxyContainer} on ${vpsHost}.`, remoteHost || "(empty)");
  }
  return remoteHost;
}

async function startTunnel(remoteHost) {
  if (await canConnect(localPort)) {
    log(`Using existing tunnel on 127.0.0.1:${localPort}.`);
    return;
  }

  log(`Opening read-only production tunnel 127.0.0.1:${localPort} -> ${vpsHost}:${remoteHost}:5432.`);
  tunnelProcess = spawn("ssh", [
    "-N",
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `127.0.0.1:${localPort}:${remoteHost}:5432`,
    vpsHost,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  tunnelProcess.once("exit", (code, signal) => {
    if (closingTunnel) return;
    if (code === 0 || signal) return;
    log(`Tunnel exited with code ${code}.`);
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await canConnect(localPort)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const stderr = tunnelProcess.stderr?.read()?.toString() || "";
  fail("Production DB tunnel did not become ready.", stderr.trim());
}

function buildReadonlyUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hostname = "127.0.0.1";
  url.port = String(localPort);
  url.searchParams.set("options", [
    "-c default_transaction_read_only=on",
    "-c statement_timeout=120000",
    "-c lock_timeout=3000",
    "-c idle_in_transaction_session_timeout=30000",
    "-c application_name=codex_prod_readonly",
  ].join(" "));
  return url.toString();
}

async function closeTunnel() {
  if (!tunnelProcess) return;
  closingTunnel = true;
  tunnelProcess.kill("SIGTERM");
  await Promise.race([
    once(tunnelProcess, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

async function withConnection(readonlyUrl, callback) {
  const client = new Client({ connectionString: readonlyUrl });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

function rejectWriteSql(sql) {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
  const forbidden = /\b(insert|update|delete|merge|truncate|alter|drop|create|grant|revoke|vacuum|analyze|refresh|reindex|copy|call|do)\b/i;
  const match = stripped.match(forbidden);
  if (match) fail(`Refusing SQL containing write/admin keyword "${match[1]}".`);
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  return fs.readFileSync(0, "utf8");
}

async function runDoctor(readonlyUrl, metadata) {
  await withConnection(readonlyUrl, async (client) => {
    const result = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS "user",
        current_setting('default_transaction_read_only') AS read_only,
        current_setting('statement_timeout') AS statement_timeout
    `);
    const row = result.rows[0];
    console.log(JSON.stringify({
      target: "production",
      vpsHost,
      appContainer: metadata.containerName,
      database: row.database,
      user: row.user,
      readOnly: row.read_only,
      statementTimeout: row.statement_timeout,
      localTunnel: `127.0.0.1:${localPort}`,
    }, null, 2));
  });
}

async function runSql(readonlyUrl, sql) {
  await withConnection(readonlyUrl, async (client) => {
    await client.query("BEGIN READ ONLY");
    try {
      const result = await client.query(sql);
      await client.query("COMMIT");
      console.log(JSON.stringify(result.rows ?? [], null, 2));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  });
}

async function runNode(readonlyUrl) {
  const nodeArgs = modeArgs.length > 0 ? modeArgs : ["--input-type=module"];
  const child = spawn(process.execPath, nodeArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      PROD_DATABASE_URL: readonlyUrl,
      DATABASE_URL: readonlyUrl,
      POSTGRES_PRISMA_URL: readonlyUrl,
      SVETOPLAVCI_DB_TARGET: "production-readonly",
      PGOPTIONS: [
        "-c default_transaction_read_only=on",
        "-c statement_timeout=120000",
        "-c lock_timeout=3000",
        "-c idle_in_transaction_session_timeout=30000",
        "-c application_name=codex_prod_readonly",
      ].join(" "),
    },
  });
  const [code, signal] = await once(child, "exit");
  if (signal) process.exit(128);
  process.exit(code ?? 0);
}

async function main() {
  if (!commandExists("ssh")) fail("Missing ssh command.");
  if (!Number.isInteger(localPort) || localPort <= 0) fail(`Invalid PROD_DB_LOCAL_PORT: ${localPort}`);
  if (!["doctor", "sql", "node"].includes(mode)) fail(`Unknown mode "${mode}". Use doctor, sql, or node.`);

  let sql = "";
  if (mode === "sql") {
    sql = modeArgs.length > 0 ? modeArgs.join(" ") : await readStdin();
    if (!sql.trim()) fail("No SQL provided. Pass SQL as an argument or stdin.");
    rejectWriteSql(sql);
  }

  const containerName = findProductionAppContainer();
  const metadata = loadProductionDbUrl(containerName);
  const remoteHost = loadProxyHost();
  await startTunnel(remoteHost);
  const readonlyUrl = buildReadonlyUrl(metadata.rawUrl);

  try {
    if (mode === "doctor") await runDoctor(readonlyUrl, metadata);
    else if (mode === "sql") await runSql(readonlyUrl, sql);
    else if (mode === "node") await runNode(readonlyUrl);
  } finally {
    await closeTunnel();
  }
}

main().catch(async (error) => {
  await closeTunnel();
  fail(error.message || String(error));
});
