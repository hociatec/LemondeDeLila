import type { WebSocket } from 'ws';
import type { WsAuthPayload } from '../../../../../shared/interfaces/public-api';

export type RealtimeIncomingMessage = {
  type: string;
  payload?: unknown;
  requestId?: string;
};

export type RealtimeClientSession = {
  socket: WebSocket;
  user: WsAuthPayload | null;
  connectionId: string;
  clientVersion: string | null;
  clientProduct: string | null;
  scope?: string;
  roomId?: number | null;
  gameType?: string | null;
  rateLimit?: { windowStartedAtMs: number; count: number };
};
