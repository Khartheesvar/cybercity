import { io, Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const socket: Socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"],
  autoConnect: true,
});

export const API_URL = BACKEND_URL;
