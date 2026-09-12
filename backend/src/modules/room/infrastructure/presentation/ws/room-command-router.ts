import type { WebSocket } from 'ws';
import type { ClientMeta } from './room-gateway.types';
import type { RoomCommandContext } from './room-command-context';
import { RoomWsUnknownCommandError } from './room-ws.errors';

export async function routeRoomCommand(
  ctx: RoomCommandContext,
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
    case 'room.state':
      await ctx.handleRoomState(client, meta);
      break;
    case 'room.ping': {
      const record = ctx.asRecord(data);
      const trace = ctx.asRecord(record._trace);
      ctx.safeSend(client, {
        type: 'room.pong',
        roomId: meta.roomId,
        payload: {
          serverTimeMs: Date.now(),
          clientSentAtMs:
            finiteNumberOrNull(record.clientSentAtMs) ??
            finiteNumberOrNull(trace.sentAtMs),
        },
      });
      break;
    }
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
      throw new RoomWsUnknownCommandError(type ?? '');
  }
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : null;
}
