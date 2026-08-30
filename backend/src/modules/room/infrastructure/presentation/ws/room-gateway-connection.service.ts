import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { UpdatePolicyService } from '../../../../update/public-api';
import { WsJwtAuthService } from '../../../../../platform/realtime/public-api';
import {
  getErrorMessage,
  isVersionLower,
} from '../../../../../shared/utils/public-api';
import { WsTicketAuthService } from '../../../../../platform/realtime/public-api';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import { RoomJoinPolicyService } from '../../../application/services/membership/room-join-policy.service';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
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
  sendChatHistoryToClient: (client: WebSocket, roomId: number) => Promise<void>;
  setSocketParticipantRoom: (client: WebSocket, roomId: number | null) => void;
  warn: (message: string) => void;
};

@Injectable()
export class RoomGatewayConnectionService {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
    private readonly auth: WsJwtAuthService,
    private readonly updates: UpdatePolicyService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly joinPolicy: RoomJoinPolicyService,
    private readonly presenter: RoomGatewayLifecyclePresenter,
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

    if (!(await this.acceptsClientVersion(client, args))) {
      return null;
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

    await this.finalizeConnection(ctx, client, meta, targetRoomId);
    return meta;
  }

  private async acceptsClientVersion(
    client: WebSocket,
    args: unknown[],
  ): Promise<boolean> {
    const version = this.auth.extractClientVersion(client, args);
    const product = this.auth.extractClientProduct(client, args);
    const minimum = await this.updates.getMinimumVersion(product);
    if (minimum && (!version || isVersionLower(version, minimum) === true)) {
      client.close(4406, 'update required');
      return false;
    }
    return true;
  }

  private async finalizeConnection(
    ctx: ConnectionContext,
    client: WebSocket,
    meta: ClientMeta,
    roomId: number,
  ): Promise<void> {
    ctx.addSocketMembership(roomId, client, meta.silent);
    ctx.setSocketParticipantRoom(
      client,
      meta.role === 'participant' && meta.silent !== true ? meta.roomId : null,
    );
    if (roomId <= 0) {
      return;
    }
    if (meta.silent) {
      await ctx.sendRoomStateToClient(client, roomId, {
        includeRealtimePlayers: true,
        includeHiddenSelf: { userId: meta.userId, username: meta.username },
      });
    } else {
      await ctx.sendRoomState(roomId);
    }
    await ctx.sendChatHistoryToClient(client, roomId);
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

    if (
      this.joinPolicy.isBanned(this.roomState.isBanned(targetRoomId, userId))
    ) {
      await ctx.sendError(client, this.presenter.presentJoinBannedError());
      return { roomId: 0 };
    }

    if (effectiveSilent && !this.joinPolicy.canUseSilentMode(isAdmin)) {
      client.close(4003, this.presenter.presentSilentModeForbiddenReason());
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
      await this.membership.leaveAllRoomsForUser(userId, {
        exceptRoomId: targetRoomId,
      });
    } catch {
      // ignore
    }

    const allowed = await ctx.canSpectate(targetRoomId, userId);
    if (!allowed) {
      client.close(4003, this.presenter.presentSpectatorForbiddenReason());
      return;
    }

    try {
      const state = await this.roomState.getRoomPayload(targetRoomId);
      if (this.clientPolicy.shouldReleaseSeatWhileSpectating(state, userId)) {
        const isOwner = state.room.owner?.id === userId;
        await this.membership.leaveRoom(targetRoomId, userId, {
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
      await this.membership.joinRoom(targetRoomId, userId);
      return role;
    } catch (err) {
      const reason = getErrorMessage(err);
      try {
        const state = await this.roomState.getRoomPayload(targetRoomId);
        if (
          !this.clientPolicy.canFallbackParticipantToSpectator(state, userId)
        ) {
          return role;
        }

        if (
          this.clientPolicy.requiresSpectateValidationForJoinFallback(
            state,
            userId,
          )
        ) {
          try {
            await this.membership.leaveAllRoomsForUser(userId, {
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

        return 'spectator';
      } catch {
        await ctx.sendError(client, reason);
        client.close(4003, reason);
        return role;
      }
    }
  }
}
