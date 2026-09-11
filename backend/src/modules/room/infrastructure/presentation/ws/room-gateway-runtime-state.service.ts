import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { RoomChatStore } from './room-chat-state';
import type { RoomSnapshot } from './room-announcement.helpers';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import type { ClientMeta } from './room-gateway.types';
import { bestEffort } from '../../../../../platform/observability/public-api';
import { type PresentedErrorPayload } from '../../../../../platform/serialization/public-api';

const MAX_WS_OUTBOUND_BYTES = 1_048_576;

@Injectable()
export class RoomGatewayRuntimeStateService implements OnModuleDestroy {
  server!: Server<typeof WebSocket>;
  readonly clients = new Map<WebSocket, ClientMeta>();
  readonly rooms = new Map<number, Set<WebSocket>>();
  readonly silentRooms = new Map<number, Set<WebSocket>>();
  readonly heartbeat = new RoomSocketHeartbeat(25_000);
  readonly roomChat = new RoomChatStore();
  readonly lastRoomStatusByRoomId = new Map<number, string>();
  readonly lastRoomSnapshotByRoomId = new Map<number, RoomSnapshot>();
  readonly pendingParticipantLeaves = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  readonly participantDisconnectGraceMs = 60_000;
  readonly logger = new Logger(RoomGatewayRuntimeStateService.name);
  private readonly messageQueues = new WeakMap<WebSocket, Promise<void>>();

  constructor(readonly presenter: RoomGatewayStatePresenter) {}

  initialize(server: Server<typeof WebSocket>): void {
    this.server = server;
  }

  enqueue(client: WebSocket, task: () => Promise<void>): Promise<void> {
    const previous = this.messageQueues.get(client) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.messageQueues.set(
      client,
      bestEffort(next, 'traitement de la file de messages room', this.logger),
    );
    return next;
  }

  deleteMessageQueue(client: WebSocket): void {
    this.messageQueues.delete(client);
  }

  onModuleDestroy(): void {
    this.heartbeat.stopAll();
    const sockets = new Set([
      ...this.clients.keys(),
      ...(this.server?.clients ?? []),
    ]);
    for (const socket of sockets) {
      try {
        socket.close(1001, 'Server shutdown');
      } catch {
        socket.terminate();
      }
    }
    const termination = setTimeout(() => {
      for (const socket of sockets) {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
      }
    }, 1_000);
    termination.unref();
    for (const timeout of this.pendingParticipantLeaves.values()) {
      clearTimeout(timeout);
    }
    this.pendingParticipantLeaves.clear();
    this.clients.clear();
    this.rooms.clear();
    this.silentRooms.clear();
    this.lastRoomStatusByRoomId.clear();
    this.lastRoomSnapshotByRoomId.clear();
    this.roomChat.clear();
  }

  async broadcast(
    roomId: number,
    type: string,
    payload: unknown,
    emittedRoomId?: number,
  ): Promise<void> {
    let message: string;
    try {
      message = JSON.stringify({
        type,
        roomId: emittedRoomId ?? roomId,
        payload,
      });
    } catch {
      return;
    }
    if (Buffer.byteLength(message, 'utf8') > MAX_WS_OUTBOUND_BYTES) return;
    this.sendToRoomSet(roomId, this.rooms.get(roomId), message, false);
    this.sendToRoomSet(roomId, this.silentRooms.get(roomId), message, true);
  }

  async sendError(
    client: WebSocket,
    error: string | PresentedErrorPayload,
  ): Promise<void> {
    if (client.readyState === WebSocket.OPEN) {
      let serialized: string;
      try {
        serialized = JSON.stringify(this.presenter.presentError(error));
      } catch {
        return;
      }
      if (Buffer.byteLength(serialized, 'utf8') <= MAX_WS_OUTBOUND_BYTES) {
        client.send(serialized);
      }
    }
  }

  sendRoomError(client: WebSocket, roomId: number, message: string): void {
    this.safeSend(client, this.presenter.presentError(message, roomId));
  }

  safeSend(client: WebSocket, payload: unknown): void {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_WS_OUTBOUND_BYTES) {
        client.close(1009, 'message too large');
        return;
      }
      client.send(serialized);
    } catch {
      try {
        client.close();
      } catch {
        // Ignore an already closed socket.
      }
    }
  }

  isAdmin(roles?: string[] | null): boolean {
    return Boolean(
      roles?.some((role) =>
        ['role_admin', 'admin', 'administrator'].includes(
          String(role ?? '')
            .trim()
            .toLowerCase(),
        ),
      ),
    );
  }

  asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private sendToRoomSet(
    roomId: number,
    sockets: Set<WebSocket> | undefined,
    message: string,
    silent: boolean,
  ): void {
    if (!sockets) {
      return;
    }
    for (const socket of Array.from(sockets)) {
      if (socket.readyState !== WebSocket.OPEN) {
        sockets.delete(socket);
        continue;
      }
      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
        try {
          socket.close();
        } catch {
          // Ignore an already closed socket.
        }
      }
    }
    if (sockets.size === 0) {
      (silent ? this.silentRooms : this.rooms).delete(roomId);
    }
  }
}
