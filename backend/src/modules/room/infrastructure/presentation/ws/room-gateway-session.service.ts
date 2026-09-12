import { Inject, Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { businessMsToIso } from '@shared/utils/public-api';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { RoomChatStore } from './room-chat-state';
import { RoomGatewaySessionPresenter } from './room-gateway-session.presenter';
import type { ClientMeta } from './room-gateway.types';
import { buildRoomInfoMessage } from './room-info.helpers';
import { listVisibleSpectators } from './room-roster';
import { projectRoomRoster } from './room-roster-projection';

type SessionContext = {
  clients: Map<WebSocket, ClientMeta>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  roomChat: RoomChatStore;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
};

@Injectable()
export class RoomGatewaySessionService {
  constructor(
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly roomState: RoomStateService,
    private readonly presenter: RoomGatewaySessionPresenter,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

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
      ctx.safeSend(client, this.presenter.presentChatHistory(roomId, messages));
    } catch {
      // best effort
    }
  }

  async handleChatHistory(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    if (!Number.isSafeInteger(meta.roomId) || meta.roomId <= 0) {
      await ctx.sendError(client, this.presenter.presentNoRoomError());
      return;
    }

    const messages = ctx.roomChat.getHistory(meta.roomId);
    ctx.safeSend(
      client,
      this.presenter.presentChatHistory(meta.roomId, messages),
    );
  }

  async handleChatSend(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
    data: unknown,
    asRecord: (value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    if (!Number.isSafeInteger(meta.roomId) || meta.roomId <= 0) {
      await ctx.sendError(client, this.presenter.presentNoRoomError());
      return;
    }

    const enabled = await this.isRoomChatEnabled(meta.roomId);
    if (!enabled) {
      await ctx.sendError(
        client,
        this.presenter.presentRoomChatDisabledError(),
      );
      return;
    }

    const now = this.clock.now();
    if (!ctx.roomChat.tryConsumeCooldown(client, now)) {
      await ctx.sendError(
        client,
        this.presenter.presentRoomChatCooldownError(),
      );
      return;
    }

    const message = ctx.roomChat.normalizeMessage(asRecord(data).message);
    if (!message) {
      return;
    }

    const chatMessage = ctx.roomChat.appendMessage(
      meta.roomId,
      {
        userId: meta.userId,
        username: meta.username,
        message,
      },
      businessMsToIso(this.clock.now()),
    );

    await ctx.broadcast(meta.roomId, 'room.chat.message', chatMessage);
  }

  async handleRoomInfo(
    ctx: SessionContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    const roomId = meta.roomId;
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      return;
    }

    const state = structuredClone(await this.roomState.getRoomPayload(roomId));
    state.room.spectators = listVisibleSpectators(ctx.clients.values(), roomId);
    state.room.counts.spectators = state.room.spectators.length;

    const message = buildRoomInfoMessage(state, meta.role);
    ctx.safeSend(client, this.presenter.presentRoomInfo(roomId, message));
  }

  async canSpectate(
    roomId: number,
    userId: number,
    invitesCanSpectate: (roomId: number, userId: number) => Promise<boolean>,
  ): Promise<boolean> {
    try {
      if (this.roomState.isBanned(roomId, userId)) {
        return false;
      }
      const state = await this.roomState.getRoomPayload(roomId);
      const access = this.clientPolicy.spectatorAccess(state, userId);
      return access === 'invitation'
        ? await invitesCanSpectate(roomId, userId)
        : access === 'allow';
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
      const leftPayload = projectRoomRoster(
        await this.roomState.getRoomPayload(roomId),
        ctx.clients.values(),
        roomId,
      );
      ctx.safeSend(socket, this.presenter.presentRoomLeft(roomId, leftPayload));
    } catch {
      ctx.safeSend(socket, this.presenter.presentRoomDeleted(roomId));
    }
  }

  private async isRoomChatEnabled(roomId: number): Promise<boolean> {
    try {
      const payload = await this.roomState.getRoomPayload(roomId);
      return payload?.manifest?.chatEnabled !== false;
    } catch {
      return false;
    }
  }
}
