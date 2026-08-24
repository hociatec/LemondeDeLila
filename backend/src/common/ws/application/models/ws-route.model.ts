import type { WsAuthPayload } from '../../../interfaces/public-api';

export type WsIncomingMessage = {
  type?: string;
  payload?: unknown;
  requestId?: string;
};

export type WsSession = {
  user: WsAuthPayload | null;
  connectionId: string;
};

export type WsRouteHandler = (
  session: WsSession,
  payload: unknown,
) => Promise<{ type: string; payload: unknown } | null>;
