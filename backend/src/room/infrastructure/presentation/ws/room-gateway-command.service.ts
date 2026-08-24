import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { extractTraceMeta, isImmediateAckAction, mapIntentToLegacyCommand } from './room-command.helpers';
import type { ClientMeta, IncomingPayload } from './room-gateway.types';
import {
  RoomWsIntentIdRequiredError,
  RoomWsUnknownIntentError,
} from '../../../domain/errors/room-ws.errors';

type CommandContext = {
  safeSend: (client: WebSocket, payload: unknown) => void;
  asRecord: (value: unknown) => Record<string, unknown>;
  sendImmediateAckIfNeeded: (
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ) => void;
  executeLegacyRoomCommand: (
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
  handleChatHistory: (
    client: WebSocket,
    meta: ClientMeta,
  ) => Promise<void>;
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
  handleRoomInfo: (
    client: WebSocket,
    meta: ClientMeta,
  ) => Promise<void>;
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

@Injectable()
export class RoomGatewayCommandService {
  decode(raw: unknown): IncomingPayload | null {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString('utf-8');
    } else {
      return null;
    }
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text) as IncomingPayload;
    } catch {
      return null;
    }
  }

  async handleCommand(
    ctx: CommandContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: IncomingPayload,
  ): Promise<void> {
    const type = payload?.type;
    const data = payload?.payload ?? {};
    const receivedAtMs = Date.now();

    if (type === 'room.intent.execute') {
      await this.handleRoomIntentExecute(ctx, client, meta, data, receivedAtMs);
      return;
    }

    ctx.sendImmediateAckIfNeeded(client, meta, type, data, receivedAtMs);
    await ctx.executeLegacyRoomCommand(
      client,
      meta,
      type,
      data,
      receivedAtMs,
    );
  }

  async handleRoomIntentExecute(
    ctx: CommandContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const envelope = ctx.asRecord(payload);
    const intentIdRaw =
      typeof envelope.intentId === 'string'
        ? envelope.intentId
        : typeof envelope.action === 'string'
          ? envelope.action
          : typeof envelope.type === 'string'
            ? envelope.type
            : '';
    const intentId = intentIdRaw.trim().toLowerCase();
    if (intentId.length === 0) {
      throw new RoomWsIntentIdRequiredError();
    }

    const legacyType = mapIntentToLegacyCommand(intentId);
    if (!legacyType) {
      throw new RoomWsUnknownIntentError(intentId);
    }

    const payloadSource = Object.prototype.hasOwnProperty.call(envelope, 'data')
      ? envelope.data
      : envelope.payload;
    const legacyPayload: Record<string, unknown> =
      payloadSource != null && typeof payloadSource === 'object'
        ? { ...(payloadSource as Record<string, unknown>) }
        : {};

    if (
      !Object.prototype.hasOwnProperty.call(legacyPayload, '_trace') &&
      envelope._trace != null &&
      typeof envelope._trace === 'object'
    ) {
      legacyPayload._trace = envelope._trace;
    }

    ctx.sendImmediateAckIfNeeded(
      client,
      meta,
      legacyType,
      legacyPayload,
      receivedAtMs,
    );
    await ctx.executeLegacyRoomCommand(
      client,
      meta,
      legacyType,
      legacyPayload,
      receivedAtMs,
    );
  }

  sendImmediateAckIfNeeded(
    ctx: CommandContext,
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ): void {
    if (!isImmediateAckAction(type)) {
      return;
    }

    const trace = extractTraceMeta(payload, receivedAtMs);
    ctx.safeSend(client, {
      type: 'room.ack',
      roomId: meta.roomId,
      payload: {
        action: type,
        traceId: trace.traceId,
        receivedAtMs,
        clientToServerMs: trace.clientToServerMs,
      },
    });
  }

  async executeLegacyRoomCommand(
    ctx: CommandContext,
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    data: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    switch (type) {
      case 'room.leave':
        await ctx.handleRoomLeave(client, meta);
        break;
      case 'room.chat.send':
        await ctx.handleChatSend(client, meta, data);
        break;
      case 'room.chat.history':
        await ctx.handleChatHistory(client, meta);
        break;
      case 'room.start':
        await ctx.handleRoomStart(meta, data, receivedAtMs);
        break;
      case 'room.reset':
        await ctx.handleRoomReset(meta, data, receivedAtMs);
        break;
      case 'room.set-role':
        await ctx.handleSetRole(client, meta, data);
        break;
      case 'room.kick':
        await ctx.handleKickOrBan(meta, data, false);
        break;
      case 'room.ban':
        await ctx.handleKickOrBan(meta, data, true);
        break;
      case 'room.set-owner':
        await ctx.handleSetOwner(meta, data);
        break;
      case 'room.set-ambience':
        await ctx.handleSetAmbience(client, meta, data, receivedAtMs);
        break;
      case 'room.toggle-privacy':
        await ctx.handleTogglePrivacy(meta, data, receivedAtMs);
        break;
      case 'room.info':
        await ctx.handleRoomInfo(client, meta);
        break;
      case 'room.ping':
        ctx.safeSend(client, {
          type: 'room.pong',
          roomId: meta.roomId,
          payload: {
            serverTimeMs: Date.now(),
            clientSentAtMs:
              typeof ctx.asRecord(data).clientSentAtMs === 'number'
                ? Number(ctx.asRecord(data).clientSentAtMs)
                : ((ctx.asRecord(ctx.asRecord(data)._trace).sentAtMs as
                    | number
                    | undefined) ?? null),
          },
        });
        break;
      case 'bot.add':
        await ctx.handleBotAdd(meta, data, receivedAtMs);
        break;
      case 'bot.remove':
        await ctx.handleBotRemove(meta, data, receivedAtMs);
        break;
      case 'room.create':
        await ctx.handleRoomCreate(client, meta, data, receivedAtMs);
        break;
      case 'room.join':
        await ctx.handleRoomJoin(client, meta, data, receivedAtMs);
        break;
      default:
        break;
    }
  }
}
