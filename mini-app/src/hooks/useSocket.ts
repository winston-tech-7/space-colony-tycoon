import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

export function useSocket(initData: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!initData) return;

    const s = io({ auth: { initData }, path: "/socket.io" });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [initData]);

  return { socket, connected };
}
