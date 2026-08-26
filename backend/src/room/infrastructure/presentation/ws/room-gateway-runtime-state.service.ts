import { Injectable, Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { RoomChatStore } from './room-chat-state';
import type { RoomSnapshot } from './room-announcement.helpers';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import type { ClientMeta } from './room-gateway.types';

@Injectable()
export class RoomGatewayRuntimeStateService {
  server!: Server<WebSocket>;
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

  initialize(server: Server<WebSocket>): void {
    this.server = server;
  }

  enqueue(client: WebSocket, task: () => Promise<void>): Promise<void> {
    const previous = this.messageQueues.get(client) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.messageQueues.set(
      client,
      next.catch(() => undefined),
    );
    return next;
  }

  deleteMessageQueue(client: WebSocket): void {
    this.messageQueues.delete(client);
  }

  async broadcast(
    roomId: number,
    type: string,
    payload: unknown,
    emittedRoomId?: number,
  ): Promise<void> {
    const message = JSON.stringify({
      type,
      roomId: emittedRoomId ?? roomId,
      payload,
    });
    this.sendToRoomSet(roomId, this.rooms.get(roomId), message, false);
    this.sendToRoomSet(roomId, this.silentRooms.get(roomId), message, true);
  }

  async sendError(client: WebSocket, message: string): Promise<void> {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(this.presenter.presentError(message)));
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
      client.send(JSON.stringify(payload));
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
    return value != null && typeof value === 'object'
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
