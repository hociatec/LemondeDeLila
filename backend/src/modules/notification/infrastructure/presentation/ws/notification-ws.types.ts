import type { WebSocket } from 'ws';

export type NotificationClientMeta = {
  userId: number;
  username: string;
  roles: string[];
  socket: WebSocket;
  origin: string | null;
  product: string | null;
};
