import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "colony",
  password: "colony",
  port: 5432,
  persistent: true,
});

const alreadyInit = existsSync("./.pgdata/PG_VERSION");
if (!alreadyInit) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase("space_colony");
} catch {
  // already exists
}

console.log("PostgreSQL ready: postgresql://colony:colony@localhost:5432/space_colony");

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});

// Keep alive
await new Promise(() => {});
