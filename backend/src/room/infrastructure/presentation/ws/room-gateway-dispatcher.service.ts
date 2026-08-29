import { Injectable } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { getErrorPayload } from '@common/utils/public-api';
import { SoundsService } from '../../../../sounds/public-api';
import { RoomGatewayActionsService } from './room-gateway-actions.service';
import { RoomGatewayBotActionsService } from './room-gateway-bot-actions.service';
import { RoomGatewayCommandService } from './room-gateway-command.service';
import { RoomGatewayConnectionService } from './room-gateway-connection.service';
import { RoomGatewayContextService } from './room-gateway-context.service';
import { RoomGatewayRuntimeStateService } from './room-gateway-runtime-state.service';
import type { ClientMeta } from './room-gateway.types';

@Injectable()
export class RoomGatewayDispatcherService {
  private readonly socketListeners = new WeakMap<
    WebSocket,
    { message: (raw: unknown) => void; error: () => void }
  >();
  constructor(
    private readonly runtime: RoomGatewayRuntimeStateService,
    private readonly contexts: RoomGatewayContextService,
    private readonly sounds: SoundsService,
    private readonly actions: RoomGatewayActionsService,
    private readonly botActions: RoomGatewayBotActionsService,
    private readonly commands: RoomGatewayCommandService,
    private readonly connection: RoomGatewayConnectionService,
  ) {}

  initialize(server: Server<typeof WebSocket>): void {
    this.runtime.initialize(server);
    this.contexts.initialize();
  }

  async handleConnection(client: WebSocket, args: unknown[]): Promise<void> {
    const meta = await this.connection.handleConnection(
      this.contexts.connectionContext(),
      client,
      args,
      (roles) => this.runtime.isAdmin(roles),
    );
    if (!meta) {
      return;
    }
    this.runtime.heartbeat.start(client);
    const message = (raw: unknown) => void this.handleMessage(client, raw);
    const error = () => client.close();
    this.socketListeners.set(client, { message, error });
    client.on('message', message);
    client.on('error', error);
  }

  handleDisconnect(client: WebSocket): Promise<void> {
    const listeners = this.socketListeners.get(client);
    if (listeners) {
      client.removeListener('message', listeners.message);
      client.removeListener('error', listeners.error);
      this.socketListeners.delete(client);
    }
    return this.contexts.presence.handleDisconnect(
      this.contexts.presenceContext(),
      client,
    );
  }

  handleMessage(client: WebSocket, raw: unknown): Promise<void> {
    return this.runtime.enqueue(client, async () => {
      const meta = this.runtime.clients.get(client);
      if (!meta) {
        client.close();
        return;
      }
      try {
        const payload = this.commands.decode(raw);
        if (payload) {
          await this.commands.handleCommand(
            this.commandContext(),
            client,
            meta,
            payload,
          );
        }
      } catch (error) {
        await this.runtime.sendError(
          client,
          getErrorPayload(error, 'Erreur temps réel'),
        );
      }
    });
  }

  private commandContext() {
    return {
      safeSend: this.runtime.safeSend.bind(this.runtime),
      asRecord: (value: unknown) => this.runtime.asRecord(value),
      sendImmediateAckIfNeeded: (
        client: WebSocket,
        meta: ClientMeta,
        type: string | undefined,
        payload: unknown,
        receivedAtMs: number,
      ) =>
        this.commands.sendImmediateAckIfNeeded(
          this.commandContext(),
          client,
          meta,
          type,
          payload,
          receivedAtMs,
        ),
      executeLegacyRoomCommand: (
        client: WebSocket,
        meta: ClientMeta,
        type: string | undefined,
        payload: unknown,
        receivedAtMs: number,
      ) =>
        this.commands.executeLegacyRoomCommand(
          this.commandContext(),
          client,
          meta,
          type,
          payload,
          receivedAtMs,
        ),
      ...this.sessionHandlers(),
      ...this.lifecycleHandlers(),
      ...this.actionHandlers(),
    };
  }

  private sessionHandlers() {
    return {
      handleChatSend: (client: WebSocket, meta: ClientMeta, data: unknown) =>
        this.contexts.session.handleChatSend(
          this.contexts.sessionContext(),
          client,
          meta,
          data,
          (value) => this.runtime.asRecord(value),
        ),
      handleChatHistory: (client: WebSocket, meta: ClientMeta) =>
        this.contexts.session.handleChatHistory(
          this.contexts.sessionContext(),
          client,
          meta,
        ),
      handleRoomInfo: (client: WebSocket, meta: ClientMeta) =>
        this.contexts.session.handleRoomInfo(
          this.contexts.sessionContext(),
          client,
          meta,
        ),
    };
  }

  private lifecycleHandlers() {
    const context = () => this.contexts.lifecycleContext();
    return {
      handleRoomLeave: (client: WebSocket, meta: ClientMeta) =>
        this.contexts.lifecycle.handleRoomLeave(context(), client, meta),
      handleRoomStart: (meta: ClientMeta, payload: unknown, at: number) =>
        this.contexts.lifecycle.handleRoomStart(context(), meta, payload, at),
      handleRoomReset: (meta: ClientMeta, payload: unknown, at: number) =>
        this.contexts.lifecycle.handleRoomReset(context(), meta, payload, at),
      handleTogglePrivacy: (meta: ClientMeta, payload: unknown, at: number) =>
        this.contexts.lifecycle.handleTogglePrivacy(
          context(),
          meta,
          payload,
          at,
        ),
      handleRoomCreate: (
        client: WebSocket,
        meta: ClientMeta,
        payload: unknown,
        at: number,
      ) =>
        this.contexts.lifecycle.handleRoomCreate(
          context(),
          client,
          meta,
          payload,
          at,
        ),
      handleRoomJoin: (
        client: WebSocket,
        meta: ClientMeta,
        payload: unknown,
        at: number,
      ) =>
        this.contexts.lifecycle.handleRoomJoin(
          context(),
          client,
          meta,
          payload,
          at,
        ),
    };
  }

  private actionHandlers() {
    const context = () => this.contexts.actionsContext();
    return {
      handleSetRole: (client: WebSocket, meta: ClientMeta, payload: unknown) =>
        this.actions.handleSetRole(context(), client, meta, payload),
      handleKickOrBan: (meta: ClientMeta, payload: unknown, ban: boolean) =>
        this.actions.handleKickOrBan(context(), meta, payload, ban),
      handleSetOwner: (meta: ClientMeta, payload: unknown) =>
        this.actions.handleSetOwner(context(), meta, payload),
      handleSetAmbience: (
        client: WebSocket,
        meta: ClientMeta,
        payload: unknown,
        at: number,
      ) =>
        this.actions.handleSetAmbience(
          context(),
          client,
          meta,
          payload,
          at,
          () => this.sounds.listTableAmbiencesWithFilter(),
        ),
      handleBotAdd: (meta: ClientMeta, payload: unknown, at: number) =>
        this.botActions.add(context(), meta, payload, at),
      handleBotRemove: (meta: ClientMeta, payload: unknown, at: number) =>
        this.botActions.remove(context(), meta, payload, at),
    };
  }
}
