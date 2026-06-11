import type { AppSocketServer } from "./socket.js";

let io: AppSocketServer | null = null;

export function setIo(server: AppSocketServer): void {
  io = server;
}

export function getIo(): AppSocketServer | null {
  return io;
}

export function emitToBattle(battleId: number, event: string, payload: unknown): void {
  io?.to(`battle:${battleId}`).emit(event, payload);
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
