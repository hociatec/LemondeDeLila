import type { Server, WebSocket } from 'ws';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import type { ClientMeta } from './room-gateway.types';

export type ActionsContext = {
  server: Server<typeof WebSocket>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  clients: Map<WebSocket, ClientMeta>;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
  broadcastRoomIntent: (roomId: number, payload: RoomIntent) => Promise<void>;
  sendRoomState: (roomId: number) => Promise<void>;
  tryUpdateRoomPayload: (
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ) => Promise<boolean>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  sendRoomError: (client: WebSocket, roomId: number, message: string) => void;
  sendRoomLeftOrDeleted: (socket: WebSocket, roomId: number) => Promise<void>;
  hasUserConnections: (roomId: number, userId: number) => boolean;
  resetClientRoomState: (meta: ClientMeta) => void;
  asRecord: (value: unknown) => Record<string, unknown>;
};
