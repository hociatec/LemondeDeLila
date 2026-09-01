import type { WebSocket } from 'ws';

type WsRequestLike = {
  headers?: Record<string, unknown>;
};

type WsClientLike = {
  upgradeReq?: WsRequestLike;
  req?: WsRequestLike;
  handshakeHeaders?: Record<string, unknown>;
};

export type RoomWsParams = {
  token: string | null;
  roomId: number;
  spectator: boolean;
  silent: boolean;
};

export function extractRoomWsParams(
  client: WebSocket,
  args: unknown[],
): RoomWsParams {
  const wsClient = toWsClient(client);
  const request = toWsRequest(args[0]) ?? wsClient.upgradeReq ?? wsClient.req;
  const token =
    extractBearer(wsClient.handshakeHeaders) || extractBearer(request?.headers);

  return { token, roomId: 0, spectator: false, silent: false };
}

function toWsClient(value: unknown): WsClientLike {
  if (!isRecord(value)) return {};
  return {
    upgradeReq: toWsRequest(value.upgradeReq),
    req: toWsRequest(value.req),
    handshakeHeaders: toHeaders(value.handshakeHeaders),
  };
}

function toWsRequest(value: unknown): WsRequestLike | undefined {
  if (!isRecord(value)) return undefined;
  return {
    headers: toHeaders(value.headers),
  };
}

function toHeaders(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function extractBearer(
  headers: Record<string, unknown> | undefined,
): string | null {
  if (!headers) return null;
  const authHeader = headers.authorization ?? headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }
  return null;
}
