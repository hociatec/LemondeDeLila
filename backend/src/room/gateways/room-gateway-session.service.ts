import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import type { RoomPayload } from '../dto/room-response.dto';
import { RoomService } from '../services/room.service';
import { RoomChatStore } from './room-chat-state';
import type { ClientMeta } from './room-gateway.types';
import { buildRoomInfoMessage } from './room-info.helpers';
import { listVisibleSpectators } from './room-roster';

type SessionContext = {
  clients: Map<WebSocket, ClientMeta>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  roomChat: RoomChatStore;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
  applySpectators: (roomId: number, payload: RoomPayload) => void;
};

@Injectable()
export class RoomGatewaySessionService {
  constructor(private readonly roomsService: RoomService) {}

  async sendChatHistoryToClient(
    ctx: SessionContext,
    client: WebSocket,
    roomId: number,
  ): Promise<void> {
    try {
      const enabled = await this.isRoomChatEnabled(roomId);
      if (!enabled) return;
      const messages = ctx.roomChat.getHistory(roomId);
      if (messages.length === 0) return;
      ctx.safeSend(client, {
        type: 'room.chat.history',
        roomId,
        payload: { messages },
      });
    } catch {
      // best effort
    }
  }

  async handleChatHistory(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    if (!meta.roomId || meta.roomId <= 0) {
      await ctx.sendError(client, 'Vous n’êtes pas dans une table.');
      return;
    }

    const messages = ctx.roomChat.getHistory(meta.roomId);
    ctx.safeSend(client, {
      type: 'room.chat.history',
      roomId: meta.roomId,
      payload: { messages },
    });
  }

  async handleChatSend(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
    data: unknown,
    asRecord: (value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    if (!meta.roomId || meta.roomId <= 0) {
      await ctx.sendError(client, 'Vous n’êtes pas dans une table.');
      return;
    }

    const enabled = await this.isRoomChatEnabled(meta.roomId);
    if (!enabled) {
      await ctx.sendError(client, 'Chat désactivé pour ce jeu.');
      return;
    }

    const now = Date.now();
    if (!ctx.roomChat.tryConsumeCooldown(client, now)) {
      await ctx.sendError(client, 'Trop rapide. Attendez un instant.');
      return;
    }

    const message = ctx.roomChat.normalizeMessage(asRecord(data).message);
    if (!message) {
      return;
    }

    const chatMessage = ctx.roomChat.appendMessage(meta.roomId, {
      userId: meta.userId,
      username: meta.username,
      message,
    });

    await ctx.broadcast(meta.roomId, 'room.chat.message', chatMessage);
  }

  async handleRoomInfo(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    const state = await this.roomsService.getRoomPayload(roomId);
    state.room.spectators = listVisibleSpectators(ctx.clients.values(), roomId);
    state.room.counts.spectators = state.room.spectators.length;

    const message = buildRoomInfoMessage(state, meta.role);

    ctx.safeSend(client, {
      type: 'room.info',
      roomId,
      payload: { message },
    });
  }

  async canSpectate(
    roomId: number,
    userId: number,
    invitesCanSpectate: (roomId: number, userId: number) => boolean,
  ): Promise<boolean> {
    try {
      if (this.roomsService.isBanned(roomId, userId)) {
        return false;
      }
      const state = await this.roomsService.getRoomPayload(roomId);
      if (!state?.room) return false;
      if (!state.room.isPrivate) {
        return true;
      }
      const isOwner = state.room.owner?.id === userId;
      const isParticipant =
        state.room.players?.some((p) => p?.id === userId) ?? false;
      if (isOwner || isParticipant) return true;
      const started =
        (state.room.status || '').toLowerCase() === 'started' ||
        Boolean(state.room.startedAt);
      return started && invitesCanSpectate(roomId, userId);
    } catch {
      return false;
    }
  }

  resetClientRoomState(meta: ClientMeta): void {
    meta.role = 'spectator';
    meta.roomId = 0;
    meta.silent = false;
  }

  async sendRoomLeftOrDeleted(
    ctx: SessionContext,
    socket: WebSocket,
    roomId: number,
  ): Promise<void> {
    try {
      const leftPayload = await this.roomsService.getRoomPayload(roomId);
      ctx.applySpectators(roomId, leftPayload);
      ctx.safeSend(socket, {
        type: 'room.left',
        roomId,
        payload: leftPayload,
      });
    } catch {
      ctx.safeSend(socket, { type: 'room.deleted', roomId });
    }
  }

  private async isRoomChatEnabled(roomId: number): Promise<boolean> {
    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      return payload?.manifest?.chatEnabled !== false;
    } catch {
      return false;
    }
  }
}
