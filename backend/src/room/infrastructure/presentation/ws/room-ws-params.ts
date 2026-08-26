import type { WebSocket } from 'ws';

type WsRequestLike = {
  url?: string;
  headers?: Record<string, unknown>;
};

type WsClientLike = {
  upgradeReq?: WsRequestLike;
  req?: WsRequestLike;
  url?: string;
  handshakeHeaders?: Record<string, unknown>;
};

export type RoomWsParams = {
  token: string | null;
  roomId: number;
  spectator: boolean;
  /**
   * Backward-compat: `silent` is accepted, but the preferred name is `hidden`.
   * This flag is reserved for admins.
   */
  silent: boolean;
};

export function extractRoomWsParams(
  client: WebSocket,
  args: unknown[],
): RoomWsParams {
  const wsClient = toWsClient(client);
  const request = toWsRequest(args[0]) ?? wsClient.upgradeReq ?? wsClient.req;
  const urlCandidate = wsClient.url || request?.url || '';
  let roomId: number;
  let token: string | null = null;
  let spectator = false;
  let silent = false;
  try {
    const url = new URL(urlCandidate, 'ws://localhost');
    token = url.searchParams.get('token');
    roomId = Number(url.searchParams.get('room') || 0);

    const spectateRaw = (
      url.searchParams.get('spectator') ||
      url.searchParams.get('spectate') ||
      ''
    ).toLowerCase();
    spectator =
      spectateRaw === '1' ||
      spectateRaw === 'true' ||
      spectateRaw === 'yes' ||
      spectateRaw === 'y';

    const silentRaw = (url.searchParams.get('silent') || '').toLowerCase();
    const hiddenRaw = (url.searchParams.get('hidden') || '').toLowerCase();
    silent =
      silentRaw === '1' ||
      silentRaw === 'true' ||
      silentRaw === 'yes' ||
      silentRaw === 'y' ||
      hiddenRaw === '1' ||
      hiddenRaw === 'true' ||
      hiddenRaw === 'yes' ||
      hiddenRaw === 'y';
  } catch {
    roomId = 0;
  }

  if (!token) {
    token =
      extractBearer(wsClient.handshakeHeaders) ||
      extractBearer(request?.headers);
  }

  return { token, roomId, spectator, silent };
}

function toWsClient(value: unknown): WsClientLike {
  if (!isRecord(value)) return {};
  return {
    upgradeReq: toWsRequest(value.upgradeReq),
    req: toWsRequest(value.req),
    url: typeof value.url === 'string' ? value.url : undefined,
    handshakeHeaders: toHeaders(value.handshakeHeaders),
  };
}

function toWsRequest(value: unknown): WsRequestLike | undefined {
  if (!isRecord(value)) return undefined;
  return {
    url: typeof value.url === 'string' ? value.url : undefined,
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
