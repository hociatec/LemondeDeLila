import { WebSocket } from 'ws';

export type ClientRole = 'participant' | 'spectator';

export type AuthedClient = {
  socket: WebSocket;
  userId: number;
  username: string;
  roomId: number;
};

export type ClientMeta = AuthedClient & {
  role: ClientRole;
  silent: boolean;
  isAdmin: boolean;
};

export type IncomingPayload = {
  type?: string;
  payload?: unknown;
};

export type RoomWithOptionalRuntimeFields = {
  runId?: unknown;
  tableAmbienceSoundId?: string | null;
};
