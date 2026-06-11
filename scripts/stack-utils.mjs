import { mkdirSync, openSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const logsDir = join(root, ".logs");
export const stackDir = join(root, ".stack");

export function ensureDirs() {
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(stackDir, { recursive: true });
}

export function pidPath(name) {
  return join(stackDir, `${name}.pid`);
}

export function readPid(name) {
  const path = pidPath(name);
  if (!existsSync(path)) return null;
  const pid = Number(readFileSync(path, "utf8").trim());
  return Number.isFinite(pid) ? pid : null;
}

export function writePid(name, pid) {
  writeFileSync(pidPath(name), String(pid));
}

export function spawnBackground(name, command, args = []) {
  ensureDirs();
  const logFd = openSync(join(logsDir, `${name}.log`), "a");
  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    shell: process.platform === "win32",
    env: process.env,
  });
  child.unref();
  writePid(name, child.pid);
  return child.pid;
}

export async function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, {
        headers: { "ngrok-skip-browser-warning": "1" },
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return false;
}

export async function waitForPort(port, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {
      try {
        const net = await import("node:net");
        await new Promise((resolve, reject) => {
          const socket = net.createConnection({ port, host: "127.0.0.1" });
          socket.once("connect", () => {
            socket.end();
            resolve(true);
          });
          socket.once("error", reject);
        });
        return true;
      } catch {
        /* retry */
      }
    }
    await sleep(1000);
  }
  return false;
}

export async function getNgrokUrl(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (!res.ok) throw new Error("ngrok api unavailable");
      const data = await res.json();
      const https = data.tunnels?.find((t) => t.public_url?.startsWith("https://"));
      if (https?.public_url) return https.public_url;
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return null;
}

export function updateWebappUrl(url) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return false;
  const current = readFileSync(envPath, "utf8");
  const next = current.replace(
    /^WEBAPP_URL=.*$/m,
    `WEBAPP_URL=${url.replace(/\/$/, "")}`,
  );
  if (next === current) return false;
  writeFileSync(envPath, next);
  return true;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
