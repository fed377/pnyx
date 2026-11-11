/**
 * Local dev dashboard: starts Expo Go in tunnel mode and shows the QR code,
 * the link, and whether the app server, tunnel and backend are up.
 *
 *   npm run dashboard     (or double-click scripts/dashboard.cmd)
 *
 * Listens on this machine only, because its buttons start and stop processes.
 */
import { exec, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const PORT = 4400;
const METRO_PORT = 8081;
const scripts = dirname(fileURLToPath(import.meta.url));
const appDir = dirname(scripts);
const run = promisify(exec);

const METRO_MS = 2000;
const MANIFEST_MS = 15_000;
const TUNNEL_MS = 10_000;
const BACKEND_MS = 30_000;
const LOG_LINES = 200;

const backendUrl = (() => {
  const env = join(appDir, ".env");
  if (!existsSync(env)) return null;
  return readFileSync(env, "utf8").match(/^EXPO_PUBLIC_API_URL=(\S+)/m)?.[1]?.replace(/\/$/, "") ?? null;
})();

const state = {
  metro: false,
  host: null,
  qr: null,
  tunnel: "off", // off | connecting | up | down
  tunnelSeen: false,
  backend: backendUrl ? "checking" : "none", // none | checking | up | down
  backendMs: null,
  lastError: null,
  stopping: false,
};

let child = null;
const logs = [];

const isTunnel = (host) => Boolean(host?.endsWith(".on.expo.app"));
const clean = (line) => line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trimEnd();
const isNoise = (line) => !line || /NO_COLOR|trace-warnings/.test(line);

function addLog(chunk) {
  for (const raw of String(chunk).split(/\r?\n/)) {
    const line = clean(raw);
    if (isNoise(line)) continue;
    logs.push(line);
    if (/ENOTFOUND|CommandError|EADDRINUSE|ngrok.*(failed|error)/i.test(line)) state.lastError = line;
  }
  logs.splice(0, Math.max(0, logs.length - LOG_LINES));
}

async function probe(url, init, timeoutMs) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

const manifestHeaders = { "expo-platform": "ios", accept: "application/expo+json,application/json" };

async function checkMetro() {
  try {
    const res = await probe(`http://localhost:${METRO_PORT}/status`, {}, 1500);
    state.metro = (await res.text()).includes("packager-status:running");
  } catch {
    state.metro = false;
  }
  if (!state.metro) {
    Object.assign(state, { host: null, qr: null, tunnel: "off", tunnelSeen: false });
  }
}

async function checkManifest() {
  if (!state.metro) return;
  try {
    const res = await probe(`http://localhost:${METRO_PORT}/`, { headers: manifestHeaders }, 10_000);
    const manifest = await res.json();
    const host = manifest.extra?.expoClient?.hostUri ?? manifest.extra?.expoGo?.debuggerHost ?? null;
    // Until the tunnel is up Expo reports 127.0.0.1, which a phone can't open.
    if (isTunnel(host) && host !== state.host) {
      state.host = host;
      state.tunnelSeen = false;
      state.tunnel = "connecting";
      state.qr = await QRCode.toString(`exp://${host}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
      void checkTunnel();
    }
  } catch {
    // Metro is up but still warming; the next pass asks again.
  }
}

async function checkTunnel() {
  if (!state.host) return;
  try {
    const res = await probe(`https://${state.host}/`, { headers: manifestHeaders }, 8000);
    if (res.ok) {
      state.tunnel = "up";
      state.tunnelSeen = true;
      state.lastError = null;
    } else {
      state.tunnel = state.tunnelSeen ? "down" : "connecting";
    }
  } catch {
    state.tunnel = state.tunnelSeen ? "down" : "connecting";
  }
}

async function checkBackend() {
  if (!backendUrl) return;
  const started = Date.now();
  try {
    // Longer than the rest: a free Render instance can take a while to wake.
    const res = await probe(`${backendUrl}/health`, {}, 25_000);
    state.backend = res.ok ? "up" : "down";
    state.backendMs = Date.now() - started;
  } catch {
    state.backend = "down";
    state.backendMs = null;
  }
}

function phase() {
  if (state.stopping) return "stopping";
  if (state.metro && state.host && state.tunnelSeen) return "running";
  if (child || state.metro) return "starting";
  return "stopped";
}

function snapshot() {
  return {
    phase: phase(),
    managed: child !== null,
    link: state.host ? `exp://${state.host}` : null,
    qr: phase() === "running" ? state.qr : null,
    tunnel: phase() === "starting" && state.tunnel === "off" ? "connecting" : state.tunnel,
    backend: state.backend,
    backendMs: state.backendMs,
    backendUrl,
    lastError: state.lastError,
    logs: logs.slice(-40),
  };
}

function start() {
  if (child || state.metro) return;
  state.lastError = null;
  logs.length = 0;
  addLog("Starting Expo in tunnel mode...");
  const proc = spawn("npx expo start --go --tunnel", { cwd: appDir, shell: true, stdio: ["ignore", "pipe", "pipe"] });
  child = proc;
  proc.stdout.on("data", addLog);
  proc.stderr.on("data", addLog);
  proc.on("exit", (code) => {
    if (child === proc) child = null;
    addLog(`Expo stopped (exit code ${code}).`);
    if (!state.stopping && code && !state.lastError) state.lastError = `Expo stopped unexpectedly (exit code ${code}).`;
  });
}

/** Whatever holds the Metro port, so a server started outside the dashboard can be stopped too. */
async function metroPid() {
  try {
    if (process.platform === "win32") {
      const { stdout } = await run(`netstat -ano -p tcp | findstr LISTENING | findstr :${METRO_PORT}`);
      return stdout.trim().split(/\s+/).pop() ?? null;
    }
    const { stdout } = await run(`lsof -ti tcp:${METRO_PORT} -sTCP:LISTEN`);
    return stdout.trim().split("\n")[0] || null;
  } catch {
    return null;
  }
}

async function killTree(pid) {
  const command = process.platform === "win32" ? `taskkill /PID ${pid} /T /F` : `kill ${pid}`;
  await run(command).catch(() => {});
}

async function stop() {
  state.stopping = true;
  try {
    if (child) await killTree(child.pid);
    const pid = await metroPid();
    if (pid) await killTree(pid);
    for (let i = 0; i < 40 && (await metroPid()); i++) await new Promise((r) => setTimeout(r, 250));
    child = null;
    await checkMetro();
  } finally {
    state.stopping = false;
  }
}

/** Only this page may press the buttons, not any website open in the same browser. */
function allowed(req) {
  const local = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
  if (!local.includes(req.headers.host ?? "")) return false;
  const origin = req.headers.origin;
  return !origin || local.some((h) => origin === `http://${h}`);
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (!allowed(req)) return send(res, 403, "{}");
  if (req.method === "GET" && req.url === "/") {
    return send(res, 200, readFileSync(join(scripts, "dashboard.html")), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && req.url === "/api/state") return send(res, 200, JSON.stringify(snapshot()));
  if (req.method === "POST" && req.url === "/api/start") {
    start();
    return send(res, 200, JSON.stringify(snapshot()));
  }
  if (req.method === "POST" && req.url === "/api/stop") {
    await stop();
    return send(res, 200, JSON.stringify(snapshot()));
  }
  if (req.method === "POST" && req.url === "/api/restart") {
    await stop();
    start();
    return send(res, 200, JSON.stringify(snapshot()));
  }
  send(res, 404, "{}");
});

async function tick() {
  await checkMetro();
  if (state.metro && !state.host) await checkManifest();
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`The dashboard is already running: http://localhost:${PORT}`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`PNYX dashboard: ${url}`);
  if (!process.env.PNYX_DASHBOARD_NO_OPEN) {
    const open = process.platform === "win32" ? `start "" ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
    exec(open);
  }
});

void tick();
void checkBackend();
setInterval(() => void tick(), METRO_MS);
setInterval(() => void checkManifest(), MANIFEST_MS);
setInterval(() => void checkTunnel(), TUNNEL_MS);
setInterval(() => void checkBackend(), BACKEND_MS);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (child) await killTree(child.pid);
    process.exit(0);
  });
}
