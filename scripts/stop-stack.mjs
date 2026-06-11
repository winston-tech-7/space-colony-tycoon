import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { readPid, pidPath } from "./stack-utils.mjs";

const names = ["server", "ngrok", "postgres"];

function killPid(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already dead */
    }
  }
}

for (const name of names) {
  const pid = readPid(name);
  if (pid) {
    killPid(pid);
    console.log(`stopped ${name} (pid ${pid})`);
  }
  const path = pidPath(name);
  if (existsSync(path)) unlinkSync(path);
}

console.log("Stack stopped.");
