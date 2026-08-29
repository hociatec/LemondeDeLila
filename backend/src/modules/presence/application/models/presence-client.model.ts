import type { WebSocket } from 'ws';
import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import type {
  PresenceAvailability,
  PresenceConnectionContext,
} from '../services/presence-state.utils';

export type PresenceClientCommand =
  | { kind: 'chat-send'; text: string }
  | { kind: 'chat-edit'; messageId: string; text: string }
  | { kind: 'chat-delete'; messageId: string }
  | {
      kind: 'presence-context';
      context: PresenceConnectionContext;
      roomId: number | null;
      roomName: string | null;
    }
  | { kind: 'presence-activity'; at: number };

export type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
  context: PresenceConnectionContext;
  contextLocked: boolean;
  roomHint: { id: number; name?: string | null } | null;
  lastInteractionAt: number;
};

export type PresenceListItem = {
  id: number;
  username: string;
  activity: PresenceConnectionContext;
  currentRoom: { id: number; name: string } | null;
  lastInteractionAt: number;
  roomStarted: boolean | null;
  availability?: PresenceAvailability;
  location?: string;
};

export type PresenceIncomingPayload =
  | { type: 'chat-send'; text?: unknown }
  | { type: 'chat-edit'; messageId?: unknown; text?: unknown }
  | { type: 'chat-delete'; messageId?: unknown }
  | {
      type: 'presence-context';
      context?: unknown;
      roomId?: unknown;
      roomName?: unknown;
    }
  | { type: 'presence-activity'; at?: unknown };
