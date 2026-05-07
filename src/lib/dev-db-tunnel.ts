import "server-only";

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const CHECK_THROTTLE_MS = 5000;
const START_WAIT_MS = 7000;
const CONNECT_TIMEOUT_MS = 900;

type DevDbTunnelState = {
  lastCheckAt: number;
  startPromise: Promise<void> | null;
};

const globalForDevDbTunnel = globalThis as unknown as {
  devDbTunnelState?: DevDbTunnelState;
};

function getState(): DevDbTunnelState {
  if (!globalForDevDbTunnel.devDbTunnelState) {
    globalForDevDbTunnel.devDbTunnelState = {
      lastCheckAt: 0,
      startPromise: null,
    };
  }
  return globalForDevDbTunnel.devDbTunnelState;
}

function getLocalTunnelPort(): number | null {
  const connectionString = process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) return null;

  try {
    const url = new URL(connectionString);
    const host = url.hostname.toLowerCase();
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocalHost) return null;

    const configuredPort = Number(process.env.DB_TUNNEL_LOCAL_PORT);
    if (Number.isInteger(configuredPort) && configuredPort > 0) return configuredPort;

    const port = Number(url.port || "5432");
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function canConnect(port: number, timeoutMs = CONNECT_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;

    const finish = (value: boolean) => {
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

async function waitUntilReady(port: number, deadlineMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < deadlineMs) {
    if (await canConnect(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return canConnect(port);
}

async function startTunnelWatchdog(port: number): Promise<void> {
  const scriptPath = path.join(process.cwd(), "scripts", "dev-db-tunnel-up.sh");
  console.info(`[dev-db-tunnel] DB tunnel is down on 127.0.0.1:${port}; starting watchdog.`);

  const child = spawn("bash", [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.unref();

  const ready = await waitUntilReady(port, START_WAIT_MS);
  if (ready) {
    console.info(`[dev-db-tunnel] DB tunnel is ready on 127.0.0.1:${port}.`);
  } else {
    console.warn(`[dev-db-tunnel] DB tunnel is still not reachable on 127.0.0.1:${port}.`);
  }
}

export async function ensureDevDbTunnel(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.DEV_DB_TUNNEL_AUTO_START === "0") return;

  const port = getLocalTunnelPort();
  if (!port) return;

  const state = getState();
  if (state.startPromise) return state.startPromise;

  const now = Date.now();
  if (now - state.lastCheckAt < CHECK_THROTTLE_MS) return;
  state.lastCheckAt = now;

  if (await canConnect(port)) return;

  state.startPromise = startTunnelWatchdog(port).finally(() => {
    state.startPromise = null;
  });

  return state.startPromise;
}
