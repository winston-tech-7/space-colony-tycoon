import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { validateInitData } from "../auth/telegram.js";
import { config } from "../config.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    const initData =
      (socket.handshake.auth?.initData as string) ||
      (socket.handshake.query?.initData as string);
    if (!initData) return next(new Error("Missing initData"));

    const auth = await validateInitData(initData, config.botToken);
    if (!auth) return next(new Error("Invalid initData"));

    socket.data.userId = auth.user.id;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as number;
    socket.join(`user:${userId}`);

    socket.on("join:guild", (guildId: number) => {
      socket.join(`guild:${guildId}`);
    });

    socket.on("join:battle", (battleId: number) => {
      socket.join(`battle:${battleId}`);
    });

    socket.emit("connected", {
      userId,
      modes: ["colony", "guild", "trading", "battle", "admiral"],
    });
  });

  return io;
}

export type AppSocketServer = ReturnType<typeof createSocketServer>;
