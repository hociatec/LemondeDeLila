import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnModuleInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { RoomPayload } from '../../../public-api';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import { CatalogService } from '../../../../catalog/public-api';
import { PerfMetricsService } from '../../../../common/observability/public-api';
import { RoomInviteService } from '../../../application/services/room-invite.service';
import { RoomRealtimeTrackerService } from '../../../application/services/room-realtime-tracker.service';
import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { RoomGatewayConnectionService } from './room-gateway-connection.service';
import { RoomGatewayLifecycleService } from './room-gateway-lifecycle.service';
import { RoomGatewayPresenceService } from './room-gateway-presence.service';
import { RoomGatewaySessionService } from './room-gateway-session.service';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import { RoomGatewayStateService } from './room-gateway-state.service';
import type { AuthedClient, ClientMeta, ClientRole, IncomingPayload } from './room-gateway.types';
import { SoundsService } from '../../../../sounds/infrastructure/storage/sounds.service';
import { RoomChatStore } from './room-chat-state';
import type { RoomSnapshot } from './room-announcement.helpers';
import { addSocketToRoomMembership } from './room-socket-membership.helpers';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';
import { RoomEventsBusService } from '../../system/room-events-bus.service';

@WebSocketGateway({ path: '/ws' })
export class RoomGateway
  implements
    OnModuleInit,
    OnGatewayConnection<WebSocket>,
    OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, ClientMeta>();
  private readonly rooms = new Map<number, Set<WebSocket>>();
  private readonly silentRooms = new Map<number, Set<WebSocket>>();
  private readonly logger = new Logger(RoomGateway.name);
  private readonly heartbeat = new RoomSocketHeartbeat(25_000);
  private readonly messageQueueByClient = new WeakMap<
    WebSocket,
    Promise<void>
  >();
  private readonly roomChat = new RoomChatStore();
  private readonly lastRoomStatusByRoomId = new Map<number, string>();
  private readonly lastRoomSnapshotByRoomId = new Map<number, RoomSnapshot>();
  private readonly participantDisconnectGraceMs = 60_000;
  private readonly pendingParticipantLeaves = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly invites: RoomInviteService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly sounds: SoundsService,
    private readonly actions: RoomGatewayActionsService,
    private readonly commands: RoomGatewayCommandService,
    private readonly connection: RoomGatewayConnectionService,
    private readonly lifecycle: RoomGatewayLifecycleService,
    private readonly presence: RoomGatewayPresenceService,
    private readonly statePresenter: RoomGatewayStatePresenter,
    private readonly state: RoomGatewayStateService,
    private readonly session: RoomGatewaySessionService,
    private readonly roomEvents: RoomEventsBusService,
  ) {}

  onModuleInit(): void {
    this.roomEvents.onRoomStateUpdated(async (roomId: number) => {
      const message = this.statePresenter.presentStateUpdated(roomId);
      await this.broadcast(roomId, message.type, message.payload, message.roomId);
      await this.sendRoomState(roomId);
    });
    this.roomEvents.onRoomDeleted(async (roomId: number) => {
      this.roomChat.clearRoom(roomId);
      this.presence.forceDisconnectRoomClients(
        this.buildPresenceContext(),
        roomId,
      );
    });
  }

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    const initialMeta = await this.connection.handleConnection(
      this.buildConnectionContext(),
      client,
      args,
      this.isAdmin.bind(this),
    );
    if (!initialMeta) {
      return;
    }

    this.heartbeat.start(client);

    client.on('message', (raw) => this.handleMessage(client, raw));
    client.on('error', () => client.close());
  }

  async handleDisconnect(client: WebSocket) {
    return this.presence.handleDisconnect(this.buildPresenceContext(), client);
  }

  @SubscribeMessage('message')
  async handleMessage(client: WebSocket, raw: unknown) {
    await this.enqueueClientMessage(client, async () => {
      const meta = this.clients.get(client);
      if (!meta) {
        client.close();
        return;
      }
      try {
        const parsed = this.decode(raw);
        if (!parsed) return;
        await this.handleCommand(client, meta, parsed);
      } catch (err) {
        await this.sendError(
          client,
          (err as Error).message || 'Erreur temps réel',
        );
      }
    });
  }

  private enqueueClientMessage(
    client: WebSocket,
    fn: () => Promise<void>,
  ): Promise<void> {
    const prev = this.messageQueueByClient.get(client) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    // Keep the chain alive even if one handler throws.
    this.messageQueueByClient.set(
      client,
      next.catch(() => {}),
    );
    return next;
  }

  private async sendRoomState(roomId: number) {
    return this.state.sendRoomState(this.buildStateContext(), roomId);
  }

  private applySpectators(roomId: number, payload: RoomPayload): void {
    this.state.applySpectators(this.buildStateContext(), roomId, payload);
  }

  private buildAllowedActionsForClient(
    meta: ClientMeta,
    payload: RoomPayload,
  ): string[] {
    return (
      this.state.withAllowedActionsForClient(payload, meta).room.allowedActions ??
      []
    );
  }

  private withAllowedActionsForClient(
    payload: RoomPayload,
    meta: ClientMeta,
  ): RoomPayload {
    return this.state.withAllowedActionsForClient(payload, meta);
  }

  private async broadcastRoomIntent(
    roomId: number,
    intent: RoomIntent,
  ): Promise<void> {
    return this.state.broadcastRoomIntent(
      this.buildStateContext(),
      roomId,
      intent,
    );
  }

  private async broadcastRoomPayload(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    return this.state.broadcastRoomPayload(
      this.buildStateContext(),
      roomId,
      payload,
    );
  }

  private async tryUpdateRoomPayload(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<boolean> {
    return this.state.tryUpdateRoomPayload(
      this.buildStateContext(),
      roomId,
      updater,
    );
  }

  private async sendRoomStateToClient(
    client: WebSocket,
    roomId: number,
    opts?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ) {
    return this.state.sendRoomStateToClient(
      this.buildStateContext(),
      client,
      roomId,
      opts,
    );
  }

  private async broadcast(
    roomId: number,
    type: string,
    payload: unknown,
    emittedRoomId?: number,
  ) {
    const message = JSON.stringify({
      type,
      roomId: emittedRoomId ?? roomId,
      payload,
    });
    const targets = this.rooms.get(roomId);
    const silentTargets = this.silentRooms.get(roomId);

    const sendToSet = (set?: Set<WebSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        if (socket.readyState !== WebSocket.OPEN) {
          set.delete(socket);
          continue;
        }
        try {
          socket.send(message);
        } catch {
          set.delete(socket);
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        }
      }
      if (set.size === 0) {
        if (set === targets) this.rooms.delete(roomId);
        if (set === silentTargets) this.silentRooms.delete(roomId);
      }
    };

    sendToSet(targets);
    sendToSet(silentTargets);
  }

  private async sendError(client: WebSocket, message: string) {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(this.statePresenter.presentError(message)));
  }

  private sendRoomError(client: WebSocket, roomId: number, message: string) {
    this.safeSend(client, this.statePresenter.presentError(message, roomId));
  }

  private safeSend(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      client.send(JSON.stringify(payload));
    } catch {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private decode(raw: unknown): IncomingPayload | null {
    return this.commands.decode(raw);
  }

  private async handleCommand(
    client: WebSocket,
    meta: ClientMeta,
    payload: IncomingPayload,
  ) {
    return this.commands.handleCommand(
      this.buildCommandContext(),
      client,
      meta,
      payload,
    );
  }

  private async handleRoomIntentExecute(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    return this.commands.handleRoomIntentExecute(
      this.buildCommandContext(),
      client,
      meta,
      payload,
      receivedAtMs,
    );
  }

  private sendImmediateAckIfNeeded(
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ): void {
    this.commands.sendImmediateAckIfNeeded(
      this.buildCommandContext(),
      client,
      meta,
      type,
      payload,
      receivedAtMs,
    );
  }

  private async executeLegacyRoomCommand(
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    data: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    return this.commands.executeLegacyRoomCommand(
      this.buildCommandContext(),
      client,
      meta,
      type,
      data,
      receivedAtMs,
    );
  }

  private async sendChatHistoryToClient(
    client: WebSocket,
    roomId: number,
  ): Promise<void> {
    return this.session.sendChatHistoryToClient(
      this.buildSessionContext(),
      client,
      roomId,
    );
  }

  private async handleChatHistory(client: WebSocket, meta: ClientMeta) {
    return this.session.handleChatHistory(
      this.buildSessionContext(),
      client,
      meta,
    );
  }

  private async handleChatSend(
    client: WebSocket,
    meta: ClientMeta,
    data: unknown,
  ) {
    return this.session.handleChatSend(
      this.buildSessionContext(),
      client,
      meta,
      data,
      this.asRecord.bind(this),
    );
  }

  private async handleRoomInfo(client: WebSocket, meta: ClientMeta) {
    return this.session.handleRoomInfo(
      this.buildSessionContext(),
      client,
      meta,
    );
  }

  private buildLifecycleContext() {
    return {
      server: this.server,
      rooms: this.rooms,
      silentRooms: this.silentRooms,
      clients: this.clients,
      sendRoomLeftOrDeleted: this.sendRoomLeftOrDeleted.bind(this),
      resetClientRoomState: this.resetClientRoomState.bind(this),
      hasUserConnections: (roomId: number, userId: number) =>
        this.presence.hasUserConnections(
          this.buildPresenceContext(),
          roomId,
          userId,
        ),
      sendRoomState: this.sendRoomState.bind(this),
      sendRoomStateToClient: this.sendRoomStateToClient.bind(this),
      broadcast: this.broadcast.bind(this),
      broadcastRoomIntent: this.broadcastRoomIntent.bind(this),
      broadcastRoomPayload: this.broadcastRoomPayload.bind(this),
      sendError: this.sendError.bind(this),
      safeSend: this.safeSend.bind(this),
      tryUpdateRoomPayload: this.tryUpdateRoomPayload.bind(this),
      canSpectate: this.canSpectate.bind(this),
      leavePreviousRoomOnSwitch: (
        previousRoomId: number,
        userId: number,
        previousRole: ClientRole,
      ) =>
        this.presence.leavePreviousRoomOnSwitch(
          this.buildPresenceContext(),
          previousRoomId,
          userId,
          previousRole,
        ),
      withAllowedActionsForClient: this.withAllowedActionsForClient.bind(this),
      asRecord: this.asRecord.bind(this),
    };
  }

  private buildStateContext() {
    return {
      clients: this.clients,
      rooms: this.rooms,
      silentRooms: this.silentRooms,
      lastRoomStatusByRoomId: this.lastRoomStatusByRoomId,
      lastRoomSnapshotByRoomId: this.lastRoomSnapshotByRoomId,
      safeSend: this.safeSend.bind(this),
      broadcast: this.broadcast.bind(this),
      sendError: this.sendError.bind(this),
      promoteConnectedSpectatorsToParticipantsForRoom: (roomId: number) =>
        this.lifecycle.promoteConnectedSpectatorsToParticipantsForRoom(
          this.buildLifecycleContext(),
          roomId,
        ),
    };
  }

  private buildConnectionContext() {
    return {
      clients: this.clients,
      addSocketMembership: (
        roomId: number,
        client: WebSocket,
        silent: boolean,
      ) =>
        addSocketToRoomMembership(
          this.rooms,
          this.silentRooms,
          roomId,
          client,
          silent,
        ),
      clearPendingParticipantLeave: (roomId: number, userId: number) =>
        this.presence.clearPendingParticipantLeave(
          this.buildPresenceContext(),
          roomId,
          userId,
        ),
      canSpectate: this.canSpectate.bind(this),
      sendError: this.sendError.bind(this),
      sendRoomState: this.sendRoomState.bind(this),
      sendRoomStateToClient: this.sendRoomStateToClient.bind(this),
      sendChatHistoryToClient: this.sendChatHistoryToClient.bind(this),
      setSocketParticipantRoom: (client: WebSocket, roomId: number | null) =>
        this.realtimeTracker.setSocketParticipantRoom(client, roomId),
      warn: (message: string) => this.logger.warn(message),
    };
  }

  private buildCommandContext() {
    return {
      safeSend: this.safeSend.bind(this),
      asRecord: this.asRecord.bind(this),
      sendImmediateAckIfNeeded: this.sendImmediateAckIfNeeded.bind(this),
      executeLegacyRoomCommand: this.executeLegacyRoomCommand.bind(this),
      handleRoomLeave: this.handleRoomLeave.bind(this),
      handleChatSend: this.handleChatSend.bind(this),
      handleChatHistory: this.handleChatHistory.bind(this),
      handleRoomStart: this.handleRoomStart.bind(this),
      handleRoomReset: this.handleRoomReset.bind(this),
      handleSetRole: this.handleSetRole.bind(this),
      handleKickOrBan: this.handleKickOrBan.bind(this),
      handleSetOwner: this.handleSetOwner.bind(this),
      handleSetAmbience: this.handleSetAmbience.bind(this),
      handleTogglePrivacy: this.handleTogglePrivacy.bind(this),
      handleRoomInfo: this.handleRoomInfo.bind(this),
      handleBotAdd: this.handleBotAdd.bind(this),
      handleBotRemove: this.handleBotRemove.bind(this),
      handleRoomCreate: this.handleRoomCreate.bind(this),
      handleRoomJoin: this.handleRoomJoin.bind(this),
    };
  }

  private buildPresenceContext() {
    return {
      clients: this.clients,
      rooms: this.rooms,
      silentRooms: this.silentRooms,
      pendingParticipantLeaves: this.pendingParticipantLeaves,
      participantDisconnectGraceMs: this.participantDisconnectGraceMs,
      clearRealtimeSocket: (client: WebSocket) => {
        this.realtimeTracker.setSocketParticipantRoom(client, null);
        this.realtimeTracker.clearSocket(client);
      },
      stopHeartbeat: (client: WebSocket) => this.heartbeat.stop(client),
      deleteMessageQueue: (client: WebSocket) =>
        this.messageQueueByClient.delete(client),
      sendRoomState: this.sendRoomState.bind(this),
      resetClientRoomState: this.resetClientRoomState.bind(this),
      sendRoomLeftOrDeleted: this.sendRoomLeftOrDeleted.bind(this),
      sendRoomError: this.sendRoomError.bind(this),
    };
  }


  private buildSessionContext() {
    return {
      clients: this.clients,
      rooms: this.rooms,
      silentRooms: this.silentRooms,
      roomChat: this.roomChat,
      sendError: this.sendError.bind(this),
      safeSend: this.safeSend.bind(this),
      broadcast: this.broadcast.bind(this),
      applySpectators: this.applySpectators.bind(this),
    };
  }
  private buildActionsContext() {
    return {
      server: this.server,
      rooms: this.rooms,
      silentRooms: this.silentRooms,
      clients: this.clients,
      broadcast: this.broadcast.bind(this),
      broadcastRoomIntent: this.broadcastRoomIntent.bind(this),
      sendRoomState: this.sendRoomState.bind(this),
      tryUpdateRoomPayload: this.tryUpdateRoomPayload.bind(this),
      sendError: this.sendError.bind(this),
      safeSend: this.safeSend.bind(this),
      sendRoomError: this.sendRoomError.bind(this),
      sendRoomLeftOrDeleted: this.sendRoomLeftOrDeleted.bind(this),
      hasUserConnections: (roomId: number, userId: number) =>
        this.presence.hasUserConnections(
          this.buildPresenceContext(),
          roomId,
          userId,
        ),
      resetClientRoomState: this.resetClientRoomState.bind(this),
      asRecord: this.asRecord.bind(this),
    };
  }
  private async handleRoomLeave(client: WebSocket, meta: ClientMeta) {
    return this.lifecycle.handleRoomLeave(
      this.buildLifecycleContext(),
      client,
      meta,
    );
  }
  private async handleRoomStart(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.lifecycle.handleRoomStart(
      this.buildLifecycleContext(),
      meta,
      payload,
      receivedAtMs,
    );
  }
  private async handleRoomReset(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.lifecycle.handleRoomReset(
      this.buildLifecycleContext(),
      meta,
      payload,
      receivedAtMs,
    );
  }
  private async handleTogglePrivacy(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.lifecycle.handleTogglePrivacy(
      this.buildLifecycleContext(),
      meta,
      payload,
      receivedAtMs,
    );
  }

  private async handleBotAdd(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.actions.handleBotAdd(
      this.buildActionsContext(),
      meta,
      payload,
      receivedAtMs,
    );
  }

  private async handleBotRemove(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.actions.handleBotRemove(
      this.buildActionsContext(),
      meta,
      payload,
      receivedAtMs,
    );
  }

  private async handleSetRole(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ) {
    return this.actions.handleSetRole(
      this.buildActionsContext(),
      client,
      meta,
      payload,
    );
  }
  private async handleRoomCreate(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.lifecycle.handleRoomCreate(
      this.buildLifecycleContext(),
      client,
      meta,
      payload,
      receivedAtMs,
    );
  }
  private async handleRoomJoin(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.lifecycle.handleRoomJoin(
      this.buildLifecycleContext(),
      client,
      meta,
      payload,
      receivedAtMs,
    );
  }

  private async handleKickOrBan(
    meta: ClientMeta,
    payload: unknown,
    ban: boolean,
  ): Promise<void> {
    return this.actions.handleKickOrBan(
      this.buildActionsContext(),
      meta,
      payload,
      ban,
    );
  }

  private async handleSetOwner(
    meta: ClientMeta,
    payload: unknown,
  ): Promise<void> {
    return this.actions.handleSetOwner(
      this.buildActionsContext(),
      meta,
      payload,
    );
  }

  private isAdmin(roles?: string[] | null): boolean {
    if (!roles || roles.length === 0) return false;
    return roles.some((r) => {
      const v = (r || '').trim().toLowerCase();
      return v === 'role_admin' || v === 'admin' || v === 'administrator';
    });
  }

  private hasUserConnections(roomId: number, userId: number): boolean {
    return this.presence.hasUserConnections(
      this.buildPresenceContext(),
      roomId,
      userId,
    );
  }

  private async handleSetAmbience(
    client: WebSocket,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    return this.actions.handleSetAmbience(
      this.buildActionsContext(),
      client,
      meta,
      payload,
      receivedAtMs,
      () => this.sounds.listTableAmbiencesWithFilter(),
    );
  }

  private scheduleDelayedParticipantLeave(
    roomId: number,
    userId: number,
  ): void {
    this.presence.scheduleDelayedParticipantLeave(
      this.buildPresenceContext(),
      roomId,
      userId,
    );
  }

  private async canSpectate(roomId: number, userId: number): Promise<boolean> {
    return this.session.canSpectate(
      roomId,
      userId,
      (nextRoomId, nextUserId) => this.invites.canSpectate(nextRoomId, nextUserId),
    );
  }

  private resetClientRoomState(meta: ClientMeta): void {
    this.session.resetClientRoomState(meta);
  }

  private async sendRoomLeftOrDeleted(
    socket: WebSocket,
    roomId: number,
  ): Promise<void> {
    return this.session.sendRoomLeftOrDeleted(
      this.buildSessionContext(),
      socket,
      roomId,
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}



