import type { WebSocket } from 'ws';
import type { ClientMeta } from './room-gateway.types';

export type RoomCommandContext = {
  safeSend: (client: WebSocket, payload: unknown) => void;
  asRecord: (value: unknown) => Record<string, unknown>;
  sendImmediateAckIfNeeded: (
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ) => void;
  executeRoomCommand: (
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    data: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleRoomLeave: (client: WebSocket, meta: ClientMeta) => Promise<void>;
  handleChatSend: (
    client: WebSocket,
    meta: ClientMeta,
    data: unknown,
  ) => Promise<void>;
  handleChatHistory: (client: WebSocket, meta: ClientMeta) => Promise<void>;
  handleRoomStart: (
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleRoomReset: (
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleSetRole: (
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ) => Promise<void>;
  handleKickOrBan: (
    meta: ClientMeta,
    payload: unknown,
    ban: boolean,
  ) => Promise<void>;
  handleSetOwner: (meta: ClientMeta, payload: unknown) => Promise<void>;
  handleSetAmbience: (
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleTogglePrivacy: (
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleRoomInfo: (client: WebSocket, meta: ClientMeta) => Promise<void>;
  handleRoomState: (client: WebSocket, meta: ClientMeta) => Promise<void>;
  handleBotAdd: (
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleBotRemove: (
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleRoomCreate: (
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
  handleRoomJoin: (
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) => Promise<void>;
};
