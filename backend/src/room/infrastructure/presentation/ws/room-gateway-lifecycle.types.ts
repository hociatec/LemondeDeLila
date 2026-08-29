import type { Server, WebSocket } from 'ws';
import type { RoomPayload } from '../../../public-api';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import type { ClientMeta, ClientRole } from './room-gateway.types';

export type LifecycleContext = {
  server: Server<typeof WebSocket>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  clients: Map<WebSocket, ClientMeta>;
  sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) => Promise<void>;
  resetClientRoomState: (meta: ClientMeta) => void;
  hasUserConnections: (roomId: number, userId: number) => boolean;
  sendRoomState: (roomId: number) => Promise<void>;
  sendRoomStateToClient: (
    client: WebSocket,
    roomId: number,
    options?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ) => Promise<void>;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
  broadcastRoomIntent: (roomId: number, payload: RoomIntent) => Promise<void>;
  broadcastRoomPayload: (roomId: number, payload: RoomPayload) => Promise<void>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  tryUpdateRoomPayload: (
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ) => Promise<boolean>;
  canSpectate: (roomId: number, userId: number) => Promise<boolean>;
  leavePreviousRoomOnSwitch: (
    previousRoomId: number,
    userId: number,
    previousRole: ClientRole,
  ) => Promise<void>;
  withAllowedActionsForClient: (
    payload: RoomPayload,
    meta: ClientMeta,
  ) => RoomPayload;
  asRecord: (value: unknown) => Record<string, unknown>;
};

export type JoinResolution = {
  roomId: number;
  silent: boolean;
  spectator: boolean;
};
