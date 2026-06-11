import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { apiRouter } from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function jsonSafe(body: unknown) {
  return JSON.parse(
    JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use((_req, res, next) => {
    const orig = res.json.bind(res);
    res.json = (body: unknown) => orig(jsonSafe(body));
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, version: "2.0.0", modes: 8, mvpModes: 3 });
  });

  app.use("/api", apiRouter);

  const distMiniApp = join(__dirname, "../../mini-app/dist");
  if (existsSync(distMiniApp)) {
    app.use(express.static(distMiniApp));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
        return next();
      }
      res.sendFile(join(distMiniApp, "index.html"));
    });
  }

  return app;
}
