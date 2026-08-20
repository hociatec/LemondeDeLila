import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { RoomService } from '../services/room.service';
import type { ClientMeta, ClientRole } from './room-gateway.types';
import { extractRoomWsParams } from './room-ws-params';

type ConnectionContext = {
  clients: Map<WebSocket, ClientMeta>;
  addSocketMembership: (
    roomId: number,
    client: WebSocket,
    silent: boolean,
  ) => void;
  clearPendingParticipantLeave: (roomId: number, userId: number) => void;
  canSpectate: (roomId: number, userId: number) => Promise<boolean>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  sendRoomState: (roomId: number) => Promise<void>;
  sendRoomStateToClient: (
    client: WebSocket,
    roomId: number,
    options?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ) => Promise<void>;
  sendChatHistoryToClient: (
    client: WebSocket,
    roomId: number,
  ) => Promise<void>;
  setSocketParticipantRoom: (
    client: WebSocket,
    roomId: number | null,
  ) => void;
  warn: (message: string) => void;
};

@Injectable()
export class RoomGatewayConnectionService {
  constructor(
    private readonly roomsService: RoomService,
    private readonly auth: WsJwtAuthService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
  ) {}

  async handleConnection(
    ctx: ConnectionContext,
    client: WebSocket,
    args: unknown[],
    isAdmin: (roles?: string[] | null) => boolean,
  ): Promise<ClientMeta | null> {
    if (!this.wsTickets.validate(client, args, 'room')) {
      ctx.warn('Connexion WS refusee: ticket manquant ou invalide.');
      client.close(4403, 'ws ticket requis');
      return null;
    }

    const clientVersion = this.auth.extractClientVersion(client, args);
    const minRequired = await this.clientUpdates.getMinRequiredVersion();
    if (minRequired) {
      const outdated =
        !clientVersion || isVersionLower(clientVersion, minRequired) === true;
      if (outdated) {
        client.close(4406, 'update required');
        return null;
      }
    }

    const { token, roomId, spectator, silent } = extractRoomWsParams(
      client,
      args,
    );
    const payload = this.auth.tryVerify(token);
    if (!payload?.id) {
      client.close(4001, 'auth required');
      return null;
    }

    const userIsAdmin = isAdmin(payload.roles);
    let targetRoomId = roomId && roomId > 0 ? roomId : 0;

    if (targetRoomId > 0) {
      const connection = await this.attachClientToRequestedRoom(
        ctx,
        client,
        payload.id,
        payload.username,
        targetRoomId,
        Boolean(silent),
        Boolean(spectator),
        userIsAdmin,
      );
      targetRoomId = connection.roomId;
      if (connection.meta) {
        ctx.clients.set(client, connection.meta);
      }
    }

    let meta = ctx.clients.get(client);
    if (!meta) {
      meta = {
        socket: client,
        userId: payload.id,
        username: payload.username,
        roomId: targetRoomId,
        role: 'participant',
        silent: false,
        isAdmin: userIsAdmin,
      };
      ctx.clients.set(client, meta);
    }

    ctx.addSocketMembership(targetRoomId, client, meta.silent);
    ctx.setSocketParticipantRoom(
      client,
      meta.role === 'participant' && meta.silent !== true ? meta.roomId : null,
    );

    if (targetRoomId > 0) {
      if (meta.silent) {
        await ctx.sendRoomStateToClient(client, targetRoomId, {
          includeRealtimePlayers: true,
          includeHiddenSelf: {
            userId: meta.userId,
            username: meta.username,
          },
        });
      } else {
        await ctx.sendRoomState(targetRoomId);
      }

      await ctx.sendChatHistoryToClient(client, targetRoomId);
    }

    return meta;
  }

  private async attachClientToRequestedRoom(
    ctx: ConnectionContext,
    client: WebSocket,
    userId: number,
    username: string,
    targetRoomId: number,
    effectiveSilent: boolean,
    spectator: boolean,
    isAdmin: boolean,
  ): Promise<{ roomId: number; meta?: ClientMeta }> {
    ctx.clearPendingParticipantLeave(targetRoomId, userId);

    if (this.roomsService.isBanned(targetRoomId, userId)) {
      await ctx.sendError(client, 'Banni de cette table.');
      return { roomId: 0 };
    }

    if (effectiveSilent && !isAdmin) {
      client.close(4003, 'Mode cache reserve aux admins');
      return { roomId: 0 };
    }

    let role: ClientRole =
      spectator || effectiveSilent ? 'spectator' : 'participant';

    if (role === 'spectator' && !effectiveSilent) {
      await this.connectSpectator(ctx, client, userId, targetRoomId);
    } else if (role !== 'spectator') {
      role = await this.connectParticipant(
        ctx,
        client,
        userId,
        targetRoomId,
        role,
      );
    }

    if (client.readyState !== WebSocket.OPEN) {
      return { roomId: 0 };
    }

    return {
      roomId: targetRoomId,
      meta: {
        socket: client,
        userId,
        username,
        roomId: targetRoomId,
        role,
        silent: effectiveSilent,
        isAdmin,
      },
    };
  }

  private async connectSpectator(
    ctx: ConnectionContext,
    client: WebSocket,
    userId: number,
    targetRoomId: number,
  ): Promise<void> {
    try {
      await this.roomsService.leaveAllRoomsForUser(userId, {
        exceptRoomId: targetRoomId,
      });
    } catch {
      // ignore
    }

    const allowed = await ctx.canSpectate(targetRoomId, userId);
    if (!allowed) {
      client.close(4003, 'Spectateur non autorise sur cette table');
      return;
    }

    try {
      const state = await this.roomsService.getRoomPayload(targetRoomId);
      const isOwner = state.room.owner?.id === userId;
      const started =
        (state.room.status || '').toLowerCase() === 'started' ||
        Boolean(state.room.startedAt);
      if (!started && (!state.room.isPrivate || isOwner)) {
        await this.roomsService.leaveRoom(targetRoomId, userId, {
          preserveRoom: true,
          preserveOwner: isOwner,
        });
      }
    } catch {
      // ignore: best effort
    }
  }

  private async connectParticipant(
    ctx: ConnectionContext,
    client: WebSocket,
    userId: number,
    targetRoomId: number,
    role: ClientRole,
  ): Promise<ClientRole> {
    try {
      await this.roomsService.joinRoom(targetRoomId, userId);
      return role;
    } catch (err) {
      const reason = (err as Error).message;
      try {
        const state = await this.roomsService.getRoomPayload(targetRoomId);
        const isOwner = state.room.owner?.id === userId;
        const isParticipant =
          state.room.players?.some((p) => p?.id === userId) ?? false;
        const isPrivate = Boolean(state.room.isPrivate);
        const started =
          (state.room.status || '').toLowerCase() === 'started' ||
          Boolean(state.room.startedAt);
        if (!isOwner && !isParticipant) {
          if (started) {
            try {
              await this.roomsService.leaveAllRoomsForUser(userId, {
                exceptRoomId: targetRoomId,
              });
            } catch {
              // ignore
            }

            const allowed = await ctx.canSpectate(targetRoomId, userId);
            if (allowed) {
              return 'spectator';
            }
            await ctx.sendError(client, reason);
            client.close(4003, reason);
            return role;
          }

          if (!isPrivate) {
            return 'spectator';
          }

          await ctx.sendError(client, reason);
          client.close(4003, reason);
          return role;
        }

        return role;
      } catch {
        await ctx.sendError(client, reason);
        client.close(4003, reason);
        return role;
      }
    }
  }
}
