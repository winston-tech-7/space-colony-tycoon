import { spawnBackground, getNgrokUrl, updateWebappUrl, waitForPort, waitForHttp, root } from "./stack-utils.mjs";

const ngrokCmd = process.env.NGROK_CMD ?? "ngrok";

console.log("Starting Space Colony stack in background...\n");

spawnBackground("postgres", "node", ["scripts/start-postgres.mjs"]);
console.log("  postgres -> .logs/postgres.log");

const pgReady = await waitForPort(5432, 90_000);
if (!pgReady) {
  console.error("PostgreSQL did not start. See .logs/postgres.log");
  process.exit(1);
}
console.log("  postgres ready");

spawnBackground("ngrok", ngrokCmd, ["http", "3000"]);
console.log("  ngrok -> .logs/ngrok.log");

const publicUrl = await getNgrokUrl(45_000);
if (!publicUrl) {
  console.error("ngrok did not start. Run: ngrok config add-authtoken <token>");
  console.error("See .logs/ngrok.log");
  process.exit(1);
}
console.log(`  ngrok ready: ${publicUrl}`);

if (updateWebappUrl(publicUrl)) {
  console.log("  updated WEBAPP_URL in .env");
}

spawnBackground("server", "npm.cmd", ["run", "dev"]);
console.log("  server -> .logs/server.log");

const appReady = await waitForHttp(`${publicUrl}/health`, 90_000);
if (!appReady) {
  console.error("Server did not become healthy. See .logs/server.log");
  process.exit(1);
}

console.log("\nAll services running in background (no windows needed).");
console.log(`Mini App URL: ${publicUrl}`);
console.log("Logs: .logs/");
console.log("Stop: npm run stack:stop");
console.log("\nIf BotFather URL changed, update Menu Button to the URL above.");
