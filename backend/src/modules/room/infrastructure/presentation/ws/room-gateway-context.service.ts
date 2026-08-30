import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { RoomInviteService } from '../../../application/services/membership/room-invite.service';
import { RoomRealtimeTrackerService } from '../../../application/services/state/room-realtime-tracker.service';
import type { RoomPayload } from '../../../public-api';
import { RoomEventsBusService } from '../../system/room-events-bus.service';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import { RoomGatewayLifecycleService } from './room-gateway-lifecycle.service';
import { RoomGatewayPresenceService } from './room-gateway-presence.service';
import { RoomGatewayRuntimeStateService } from './room-gateway-runtime-state.service';
import { RoomGatewaySessionService } from './room-gateway-session.service';
import { RoomGatewayStateService } from './room-gateway-state.service';
import type { ClientMeta, ClientRole } from './room-gateway.types';
import { addSocketToRoomMembership } from './room-socket-membership.helpers';

type RoomStateClientOptions = {
  includeRealtimePlayers?: boolean;
  includeHiddenSelf?: { userId: number; username: string };
};

@Injectable()
export class RoomGatewayContextService {
  constructor(
    readonly runtime: RoomGatewayRuntimeStateService,
    readonly invites: RoomInviteService,
    readonly realtimeTracker: RoomRealtimeTrackerService,
    readonly lifecycle: RoomGatewayLifecycleService,
    readonly presence: RoomGatewayPresenceService,
    readonly state: RoomGatewayStateService,
    readonly session: RoomGatewaySessionService,
    private readonly roomEvents: RoomEventsBusService,
  ) {}

  initialize(): void {
    this.roomEvents.onRoomStateUpdated(async (roomId: number) => {
      const message = this.runtime.presenter.presentStateUpdated(roomId);
      await this.runtime.broadcast(
        roomId,
        message.type,
        message.payload,
        message.roomId,
      );
      await this.state.sendRoomState(this.stateContext(), roomId);
    });
    this.roomEvents.onRoomDeleted(async (roomId: number) => {
      this.runtime.roomChat.clearRoom(roomId);
      this.presence.forceDisconnectRoomClients(this.presenceContext(), roomId);
    });
  }

  stateContext() {
    return {
      clients: this.runtime.clients,
      rooms: this.runtime.rooms,
      silentRooms: this.runtime.silentRooms,
      lastRoomStatusByRoomId: this.runtime.lastRoomStatusByRoomId,
      lastRoomSnapshotByRoomId: this.runtime.lastRoomSnapshotByRoomId,
      safeSend: (client: WebSocket, payload: unknown) =>
        this.runtime.safeSend(client, payload),
      broadcast: this.runtime.broadcast.bind(this.runtime),
      sendError: this.runtime.sendError.bind(this.runtime),
      promoteConnectedSpectatorsToParticipantsForRoom: (roomId: number) =>
        this.lifecycle.promoteConnectedSpectatorsToParticipantsForRoom(
          this.lifecycleContext(),
          roomId,
        ),
    };
  }

  presenceContext() {
    return {
      clients: this.runtime.clients,
      rooms: this.runtime.rooms,
      silentRooms: this.runtime.silentRooms,
      pendingParticipantLeaves: this.runtime.pendingParticipantLeaves,
      participantDisconnectGraceMs: this.runtime.participantDisconnectGraceMs,
      clearRealtimeSocket: (client: WebSocket) => {
        this.realtimeTracker.setSocketParticipantRoom(client, null);
        this.realtimeTracker.clearSocket(client);
      },
      stopHeartbeat: (client: WebSocket) => this.runtime.heartbeat.stop(client),
      deleteMessageQueue: (client: WebSocket) =>
        this.runtime.deleteMessageQueue(client),
      sendRoomState: (roomId: number) =>
        this.state.sendRoomState(this.stateContext(), roomId),
      resetClientRoomState: (meta: ClientMeta) =>
        this.session.resetClientRoomState(meta),
      sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) =>
        this.session.sendRoomLeftOrDeleted(
          this.sessionContext(),
          client,
          roomId,
        ),
      sendRoomError: this.runtime.sendRoomError.bind(this.runtime),
    };
  }

  sessionContext() {
    return {
      clients: this.runtime.clients,
      rooms: this.runtime.rooms,
      silentRooms: this.runtime.silentRooms,
      roomChat: this.runtime.roomChat,
      sendError: this.runtime.sendError.bind(this.runtime),
      safeSend: this.runtime.safeSend.bind(this.runtime),
      broadcast: this.runtime.broadcast.bind(this.runtime),
      applySpectators: (roomId: number, payload: RoomPayload) =>
        this.state.applySpectators(this.stateContext(), roomId, payload),
    };
  }

  connectionContext() {
    return {
      clients: this.runtime.clients,
      addSocketMembership: (
        roomId: number,
        client: WebSocket,
        silent: boolean,
      ) =>
        addSocketToRoomMembership(
          this.runtime.rooms,
          this.runtime.silentRooms,
          roomId,
          client,
          silent,
        ),
      clearPendingParticipantLeave: (roomId: number, userId: number) =>
        this.presence.clearPendingParticipantLeave(
          this.presenceContext(),
          roomId,
          userId,
        ),
      canSpectate: (roomId: number, userId: number) =>
        this.canSpectate(roomId, userId),
      sendError: this.runtime.sendError.bind(this.runtime),
      sendRoomState: (roomId: number) =>
        this.state.sendRoomState(this.stateContext(), roomId),
      sendRoomStateToClient: (
        client: WebSocket,
        roomId: number,
        options?: RoomStateClientOptions,
      ) =>
        this.state.sendRoomStateToClient(
          this.stateContext(),
          client,
          roomId,
          options,
        ),
      sendChatHistoryToClient: (client: WebSocket, roomId: number) =>
        this.session.sendChatHistoryToClient(
          this.sessionContext(),
          client,
          roomId,
        ),
      setSocketParticipantRoom: (client: WebSocket, roomId: number | null) =>
        this.realtimeTracker.setSocketParticipantRoom(client, roomId),
      warn: (message: string) => this.runtime.logger.warn(message),
    };
  }

  lifecycleContext() {
    return {
      server: this.runtime.server,
      rooms: this.runtime.rooms,
      silentRooms: this.runtime.silentRooms,
      clients: this.runtime.clients,
      sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) =>
        this.session.sendRoomLeftOrDeleted(
          this.sessionContext(),
          client,
          roomId,
        ),
      resetClientRoomState: (meta: ClientMeta) =>
        this.session.resetClientRoomState(meta),
      hasUserConnections: (roomId: number, userId: number) =>
        this.presence.hasUserConnections(
          this.presenceContext(),
          roomId,
          userId,
        ),
      sendRoomState: (roomId: number) =>
        this.state.sendRoomState(this.stateContext(), roomId),
      sendRoomStateToClient: (
        client: WebSocket,
        roomId: number,
        options?: RoomStateClientOptions,
      ) =>
        this.state.sendRoomStateToClient(
          this.stateContext(),
          client,
          roomId,
          options,
        ),
      broadcast: this.runtime.broadcast.bind(this.runtime),
      broadcastRoomIntent: (roomId: number, intent: RoomIntent) =>
        this.state.broadcastRoomIntent(this.stateContext(), roomId, intent),
      broadcastRoomPayload: (roomId: number, payload: RoomPayload) =>
        this.state.broadcastRoomPayload(this.stateContext(), roomId, payload),
      sendError: this.runtime.sendError.bind(this.runtime),
      safeSend: this.runtime.safeSend.bind(this.runtime),
      tryUpdateRoomPayload: (
        roomId: number,
        updater: (payload: RoomPayload) => RoomPayload | null,
      ) =>
        this.state.tryUpdateRoomPayload(this.stateContext(), roomId, updater),
      canSpectate: (roomId: number, userId: number) =>
        this.canSpectate(roomId, userId),
      leavePreviousRoomOnSwitch: (
        roomId: number,
        userId: number,
        role: ClientRole,
      ) =>
        this.presence.leavePreviousRoomOnSwitch(
          this.presenceContext(),
          roomId,
          userId,
          role,
        ),
      withAllowedActionsForClient: (payload: RoomPayload, meta: ClientMeta) =>
        this.state.withAllowedActionsForClient(payload, meta),
      asRecord: (value: unknown) => this.runtime.asRecord(value),
    };
  }

  actionsContext() {
    return {
      server: this.runtime.server,
      rooms: this.runtime.rooms,
      silentRooms: this.runtime.silentRooms,
      clients: this.runtime.clients,
      broadcast: this.runtime.broadcast.bind(this.runtime),
      broadcastRoomIntent: (roomId: number, intent: RoomIntent) =>
        this.state.broadcastRoomIntent(this.stateContext(), roomId, intent),
      sendRoomState: (roomId: number) =>
        this.state.sendRoomState(this.stateContext(), roomId),
      tryUpdateRoomPayload: (
        roomId: number,
        updater: (payload: RoomPayload) => RoomPayload | null,
      ) =>
        this.state.tryUpdateRoomPayload(this.stateContext(), roomId, updater),
      sendError: this.runtime.sendError.bind(this.runtime),
      safeSend: this.runtime.safeSend.bind(this.runtime),
      sendRoomError: this.runtime.sendRoomError.bind(this.runtime),
      sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) =>
        this.session.sendRoomLeftOrDeleted(
          this.sessionContext(),
          client,
          roomId,
        ),
      hasUserConnections: (roomId: number, userId: number) =>
        this.presence.hasUserConnections(
          this.presenceContext(),
          roomId,
          userId,
        ),
      resetClientRoomState: (meta: ClientMeta) =>
        this.session.resetClientRoomState(meta),
      asRecord: (value: unknown) => this.runtime.asRecord(value),
    };
  }

  canSpectate(roomId: number, userId: number): Promise<boolean> {
    return this.session.canSpectate(roomId, userId, (nextRoomId, nextUserId) =>
      this.invites.canSpectate(nextRoomId, nextUserId),
    );
  }
}
