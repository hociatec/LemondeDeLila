import type { WebSocket } from 'ws';

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
  args: any[],
): RoomWsParams {
  const request: any =
    (args && args[0]) || (client as any).upgradeReq || (client as any).req;
  const urlCandidate = (client as any).url || request?.url || '';
  let roomId = 0;
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
      extractBearer((client as any).handshakeHeaders) ||
      extractBearer(request?.headers);
  }

  return { token, roomId, spectator, silent };
}

function extractBearer(headers: any): string | null {
  if (!headers) return null;
  const authHeader = headers.authorization || headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }
  return null;
}

