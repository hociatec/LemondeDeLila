import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { bestEffort } from '@shared/utils/public-api';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import type { ClientMeta, ClientRole } from './room-gateway.types';
import { hasUserConnectionsInRoom } from './room-socket-membership.helpers';

type PresenceContext = {
  clients: Map<WebSocket, ClientMeta>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  pendingParticipantLeaves: Map<string, ReturnType<typeof setTimeout>>;
  participantDisconnectGraceMs: number;
  clearRealtimeSocket: (client: WebSocket) => void;
  stopHeartbeat: (client: WebSocket) => void;
  deleteMessageQueue: (client: WebSocket) => void;
  sendRoomState: (roomId: number) => Promise<void>;
  resetClientRoomState: (meta: ClientMeta) => void;
  sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) => Promise<void>;
  sendRoomError: (client: WebSocket, roomId: number, message: string) => void;
};

@Injectable()
export class RoomGatewayPresenceService {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
  ) {}

  forceDisconnectRoomClients(ctx: PresenceContext, roomId: number): void {
    const targets = ctx.rooms.get(roomId);
    const silentTargets = ctx.silentRooms.get(roomId);

    const socketSet = new Set<WebSocket>();
    if (targets) {
      for (const socket of targets) socketSet.add(socket);
    }
    if (silentTargets) {
      for (const socket of silentTargets) socketSet.add(socket);
    }
    for (const [socket, meta] of ctx.clients.entries()) {
      if (meta?.roomId === roomId) {
        socketSet.add(socket);
      }
    }

    const deletedMessage = JSON.stringify({ type: 'room.deleted', roomId });

    for (const socket of socketSet) {
      ctx.clearRealtimeSocket(socket);
      ctx.stopHeartbeat(socket);
      ctx.deleteMessageQueue(socket);
      ctx.clients.delete(socket);
      targets?.delete(socket);
      silentTargets?.delete(socket);

      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(deletedMessage, () => {
            try {
              socket.close();
            } catch {
              // ignore
            }
          });
        } else {
          socket.close();
        }
      } catch {
        // ignore
      }
    }

    if (targets?.size === 0) ctx.rooms.delete(roomId);
    if (silentTargets?.size === 0) ctx.silentRooms.delete(roomId);
  }

  clearPendingParticipantLeave(
    ctx: PresenceContext,
    roomId: number,
    userId: number,
  ): void {
    const key = this.buildParticipantLeaveKey(roomId, userId);
    const existing = ctx.pendingParticipantLeaves.get(key);
    if (!existing) return;
    clearTimeout(existing);
    ctx.pendingParticipantLeaves.delete(key);
  }

  hasUserConnections(
    ctx: PresenceContext,
    roomId: number,
    userId: number,
  ): boolean {
    return hasUserConnectionsInRoom(
      ctx.rooms,
      ctx.silentRooms,
      ctx.clients,
      roomId,
      userId,
    );
  }

  scheduleDelayedParticipantLeave(
    ctx: PresenceContext,
    roomId: number,
    userId: number,
  ): void {
    const key = this.buildParticipantLeaveKey(roomId, userId);
    if (ctx.pendingParticipantLeaves.has(key)) return;

    const timeout = setTimeout(() => {
      ctx.pendingParticipantLeaves.delete(key);
      if (this.hasUserConnections(ctx, roomId, userId)) return;

      void bestEffort(
        this.membership
          .leaveRoom(roomId, userId, {
            preserveRoom: false,
            disconnectOnly: false,
            replaceWithBot: false,
          })
          .then(() => ctx.sendRoomState(roomId)),
        `départ différé room=${roomId} user=${userId}`,
      );
    }, ctx.participantDisconnectGraceMs);

    ctx.pendingParticipantLeaves.set(key, timeout);
  }

  async leavePreviousRoomOnSwitch(
    ctx: PresenceContext,
    previousRoomId: number,
    userId: number,
    previousRole: ClientRole,
  ): Promise<void> {
    try {
      if (previousRole === 'spectator') {
        await this.membership.transferOwnerIfCurrent(previousRoomId, userId);
      }
      await this.membership.leaveRoom(previousRoomId, userId, {
        preserveRoom: false,
        disconnectOnly: false,
      });
    } catch {
      // best effort: ne pas bloquer le join.
    }

    try {
      await ctx.sendRoomState(previousRoomId);
    } catch {
      // ignore
    }
  }

  async handleDisconnect(
    ctx: PresenceContext,
    client: WebSocket,
  ): Promise<void> {
    const meta = ctx.clients.get(client);
    ctx.clearRealtimeSocket(client);
    ctx.clients.delete(client);
    ctx.deleteMessageQueue(client);
    ctx.stopHeartbeat(client);

    let ownerId: number | null = null;
    if (meta && meta.roomId > 0) {
      try {
        const state = await this.roomState.getRoomPayload(meta.roomId);
        ownerId = state?.room?.owner?.id ?? null;
      } catch {
        ownerId = null;
      }
    }

    if (!meta) {
      return;
    }

    const roomSockets = ctx.rooms.get(meta.roomId);
    const silentRoomSockets = ctx.silentRooms.get(meta.roomId);
    roomSockets?.delete(client);
    silentRoomSockets?.delete(client);
    if (roomSockets?.size === 0) ctx.rooms.delete(meta.roomId);
    if (silentRoomSockets?.size === 0) ctx.silentRooms.delete(meta.roomId);

    const remainingTotalConnections =
      (ctx.rooms.get(meta.roomId)?.size ?? 0) +
      (ctx.silentRooms.get(meta.roomId)?.size ?? 0);
    const userStillConnected = this.hasUserConnections(
      ctx,
      meta.roomId,
      meta.userId,
    );

    if (meta.role === 'participant') {
      if (!userStillConnected) {
        void bestEffort(
          this.membership.leaveRoom(meta.roomId, meta.userId, {
            preserveRoom: true,
            disconnectOnly: true,
          }),
          `déconnexion participant room=${meta.roomId} user=${meta.userId}`,
        );
        this.scheduleDelayedParticipantLeave(ctx, meta.roomId, meta.userId);
      }
    } else {
      if (!userStillConnected && ownerId === meta.userId) {
        void bestEffort(
          this.membership.transferOwnerIfCurrent(meta.roomId, meta.userId),
          `transfert propriétaire room=${meta.roomId} user=${meta.userId}`,
        );
      }

      if (remainingTotalConnections === 0) {
        void bestEffort(
          this.membership.leaveRoom(meta.roomId, meta.userId, {
            preserveRoom: false,
            disconnectOnly: false,
          }),
          `nettoyage dernière connexion room=${meta.roomId} user=${meta.userId}`,
        );
      }
    }

    if (meta.roomId > 0 && meta.silent !== true) {
      void bestEffort(
        this.roomState
          .getRoomPayload(meta.roomId)
          .then(() => ctx.sendRoomState(meta.roomId)),
        `rafraîchissement après déconnexion room=${meta.roomId}`,
      );
    }
  }

  async disconnectUserFromRoom(
    ctx: PresenceContext,
    roomId: number,
    userId: number,
    message: string,
  ): Promise<void> {
    const sockets: WebSocket[] = [];
    const roomSockets = ctx.rooms.get(roomId);
    const silentRoomSockets = ctx.silentRooms.get(roomId);
    if (roomSockets) sockets.push(...Array.from(roomSockets));
    if (silentRoomSockets) sockets.push(...Array.from(silentRoomSockets));

    for (const socket of sockets) {
      const meta = ctx.clients.get(socket);
      if (!meta || meta.roomId !== roomId || meta.userId !== userId) {
        continue;
      }

      try {
        ctx.sendRoomError(socket, roomId, message);
      } catch {
        // ignore
      }

      ctx.clearRealtimeSocket(socket);
      roomSockets?.delete(socket);
      silentRoomSockets?.delete(socket);

      ctx.resetClientRoomState(meta);
      await ctx.sendRoomLeftOrDeleted(socket, roomId);
    }

    if (roomSockets?.size === 0) ctx.rooms.delete(roomId);
    if (silentRoomSockets?.size === 0) ctx.silentRooms.delete(roomId);
  }

  private buildParticipantLeaveKey(roomId: number, userId: number): string {
    return `${roomId}:${userId}`;
  }
}
