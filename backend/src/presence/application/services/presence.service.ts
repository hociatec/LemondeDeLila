import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { Inject } from '@nestjs/common';
import { WsAuthPayload } from '../../../common/interfaces/ws-auth-payload';
import {
  PresenceEvent,
  PresenceTransport,
} from '../ports/presence-transport.port';
import {
  PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
  type PresenceRoomParticipantRepository,
} from '../ports/presence-room-participant.repository';
import {
  PresenceChatCommandResult,
  PresenceChatService,
} from './presence-chat.service';
import {
  type PresenceAvailability,
  type PresenceBroadcastPlayer,
  type PresenceConnectionContext,
  type PresencePublicPlayer,
  enrichPresencePlayers,
  mergePresencePlayersFromOrigins,
  normalizePresenceContext,
  parsePresenceRoomId,
  scorePresenceActivity,
} from './presence-state.utils';

type PresenceActivity = PresenceConnectionContext;

export type PresenceClientCommand =
  | { kind: 'chat-send'; text: string }
  | { kind: 'chat-edit'; messageId: string; text: string }
  | { kind: 'chat-delete'; messageId: string }
  | {
      kind: 'presence-context';
      context: PresenceConnectionContext;
      roomId: number | null;
      roomName: string | null;
    }
  | { kind: 'presence-activity'; at: number };

type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
  context: PresenceConnectionContext;
  contextLocked: boolean;
  roomHint: { id: number; name?: string | null } | null;
  lastInteractionAt: number;
};

export type PresenceListItem = {
  id: number;
  username: string;
  activity: PresenceConnectionContext;
  currentRoom: { id: number; name: string } | null;
  lastInteractionAt: number;
  roomStarted: boolean | null;
  availability?: PresenceAvailability;
  location?: string;
};

type PresenceIncomingPayload =
  | {
      type: 'chat-send';
      text?: unknown;
    }
  | {
      type: 'chat-edit';
      messageId?: unknown;
      text?: unknown;
    }
  | {
      type: 'chat-delete';
      messageId?: unknown;
    }
  | {
      type: 'presence-context';
      context?: unknown;
      roomId?: unknown;
      roomName?: unknown;
    }
  | {
      type: 'presence-activity';
      at?: unknown;
    };

type BinaryPayloadLike =
  | Buffer
  | ArrayBuffer
  | ArrayBufferView
  | { byteLength: number };

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly clients = new Map<WebSocket, PresenceClient>();
  private readonly playersByOrigin = new Map<
    string,
    { at: number; players: PresencePublicPlayer[] }
  >();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pingIntervalMs = 30_000;
  private readonly pingTimeoutMs = 10_000;
  private readonly instanceId = randomUUID();
  private readonly originTtlMs = 120_000;
  private readonly absentAfterMs = 3 * 60_000;

  constructor(
    private readonly chat: PresenceChatService,
    @Inject(PRESENCE_ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: PresenceRoomParticipantRepository,
    private readonly transport: PresenceTransport,
  ) {
    this.transport
      .subscribe((event) => this.handleExternalPresence(event))
      .catch((err) =>
        this.logger.error('Impossible de souscrire aux updates presence', err),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.transport.disconnect();
  }

  register(
    socket: WebSocket,
    user: WsAuthPayload,
    context: PresenceConnectionContext = 'home',
  ) {
    this.clients.set(socket, {
      socket,
      user,
      context,
      contextLocked: false,
      roomHint: null,
      lastInteractionAt: Date.now(),
    });
    this.ensureHeartbeat();
  }

  unregister(socket: WebSocket) {
    this.clients.delete(socket);
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  async handleClientPayload(from: PresenceClient, raw: unknown) {
    let textPayload: string;
    if (typeof raw === 'string') {
      textPayload = raw;
    } else if (Buffer.isBuffer(raw)) {
      textPayload = raw.toString('utf-8');
    } else if (this.isBinaryPayload(raw)) {
      textPayload = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return;
    }
    if (textPayload.length > 16_384) {
      this.logger.warn('Message WS trop volumineux, rejeté');
      return;
    }
    let payload: PresenceIncomingPayload | null = null;
    try {
      payload = this.parseIncomingPayload(JSON.parse(textPayload));
    } catch {
      return;
    }
    if (!payload) {
      return;
    }
    if (payload.type === 'chat-send') {
      from.lastInteractionAt = Date.now();
      await this.handleChatSend(from, payload);
      return;
    }
    if (payload.type === 'chat-edit') {
      from.lastInteractionAt = Date.now();
      await this.handleChatEdit(from, payload);
      return;
    }
    if (payload.type === 'chat-delete') {
      from.lastInteractionAt = Date.now();
      await this.handleChatDelete(from, payload);
      return;
    }
    if (payload.type === 'presence-context') {
      from.lastInteractionAt = Date.now();
      this.handlePresenceContext(from, payload);
      this.broadcastPresence();
      return;
    }
    if (payload.type === 'presence-activity') {
      // Client-side interaction heartbeat (keyboard/mouse/touch), used for "absent" detection.
      const at =
        typeof payload.at === 'number' && Number.isFinite(payload.at)
          ? payload.at
          : Date.now();
      from.lastInteractionAt = at;
      // No immediate broadcast; heartbeat will refresh periodically, and other events can rebroadcast.
    }
  }

  private async handleChatSend(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-send' }>,
  ) {
    const text = typeof payload.text === 'string' ? payload.text : '';
    const result = await this.chat.sendMessage(from.user, text);
    this.handleChatCommandResult(from.socket, result, (event) =>
      this.broadcastChat(event),
    );
  }

  private async handleChatEdit(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-edit' }>,
  ) {
    const text = typeof payload.text === 'string' ? payload.text : '';
    const messageId =
      typeof payload.messageId === 'string' ? payload.messageId.trim() : '';
    if (!messageId) {
      return;
    }
    const result = await this.chat.editMessage(from.user, messageId, text);
    this.handleChatCommandResult(from.socket, result, (event) =>
      this.broadcastChat(event),
    );
  }

  private async handleChatDelete(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-delete' }>,
  ) {
    const messageId =
      typeof payload.messageId === 'string' ? payload.messageId.trim() : '';
    if (!messageId) {
      return;
    }
    const result = await this.chat.deleteMessage(from.user, messageId);
    this.handleChatCommandResult(from.socket, result, (event) =>
      this.broadcastChat(event),
    );
  }

  async isChatBannedNow(userId: number): Promise<boolean> {
    return this.chat.isChatBannedNow(userId);
  }

  async getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    return this.chat.getChatBanInfo(userId);
  }

  private handleChatCommandResult(
    socket: WebSocket,
    result: PresenceChatCommandResult,
    onOk: (event: Record<string, unknown>) => void,
  ) {
    if (result.kind === 'message-posted') {
      onOk({ type: 'chat-message', payload: result.message });
      return;
    }
    if (result.kind === 'message-updated') {
      onOk({ type: 'chat-message.updated', payload: result.message });
      return;
    }
    if (result.kind === 'message-deleted') {
      onOk({ type: 'chat-message.deleted', payload: { id: result.messageId } });
      return;
    }
    if (result.kind === 'denied') {
      this.safeSend(socket, {
        type: 'error',
        payload: result.payload,
      });
      try {
        socket.close(4403, 'chat banned');
      } catch {
        /* ignore */
      }
      return;
    }
    if (result.kind === 'error') {
      this.safeSend(socket, {
        type: 'error',
        payload: {
          message: result.message,
        },
      });
    }
  }

  private safeSend(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private handlePresenceContext(
    client: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'presence-context' }>,
  ) {
    const raw =
      typeof payload.context === 'string' ? payload.context.toLowerCase() : '';
    const context = normalizePresenceContext(raw);
    client.context = context;
    client.contextLocked = true;
    if (context === 'table') {
      const roomId = parsePresenceRoomId(payload.roomId);
      if (roomId !== null) {
        let name: string | null = null;
        if (typeof payload.roomName === 'string') {
          const trimmed = payload.roomName.trim();
          name = trimmed.length > 0 ? trimmed : null;
        }
        client.roomHint = { id: roomId, name };
      } else {
        client.roomHint = null;
      }
    } else {
      client.roomHint = null;
    }
  }

  async sendHistory(to: WebSocket) {
    try {
      const history = await this.chat.buildChatHistory();
      to.send(
        JSON.stringify({
          type: 'chat-history',
          editWindowSeconds: history.editWindowSeconds,
          messages: history.messages,
        }),
      );
    } catch (err) {
      this.logger.error('Echec envoi historique chat', err as Error);
      to.close();
    }
  }

  broadcastPresence() {
    const playersByUser = this.collectPlayers();
    this.attachRooms(playersByUser)
      .then(() => this.emitPresence(playersByUser))
      .catch((err) => {
        this.logger.warn(
          'attachRooms a échoué, diffusion présence sans room enrichie',
          err as Error,
        );
        this.emitPresence(playersByUser);
      });
  }

  /**
   * Best-effort check: true if the user has at least one active presence connection in "tavern" context.
   * Used by features that require all players to be available before starting/restoring a table.
   */
  isUserInTavern(userId: number): boolean {
    if (!Number.isFinite(userId) || userId <= 0) return false;
    for (const client of this.clients.values()) {
      if (client?.user?.id !== userId) continue;
      if (client.context === 'tavern') return true;
    }
    return false;
  }

  private collectPlayers(): Map<number, PresenceBroadcastPlayer> {
    const playersByUser = new Map<number, PresenceBroadcastPlayer>();
    for (const client of this.clients.values()) {
      const { user, context, roomHint, contextLocked } = client;
      const activity: PresenceActivity = context ?? 'home';
      const candidate: PresenceBroadcastPlayer = {
        id: user.id,
        username: user.username,
        currentRoom: roomHint
          ? { id: roomHint.id, name: roomHint.name ?? `Table #${roomHint.id}` }
          : null,
        activity,
        contextLocked,
        lastInteractionAt: client.lastInteractionAt ?? Date.now(),
        roomStarted: null,
      };
      const existing = playersByUser.get(user.id);
      if (!existing) {
        playersByUser.set(user.id, candidate);
        continue;
      }
      const currentScore = scorePresenceActivity(existing.activity);
      const candidateScore = scorePresenceActivity(candidate.activity);
      if (candidateScore < currentScore) {
        playersByUser.set(user.id, candidate);
        continue;
      }
      if (candidateScore === currentScore) {
        existing.contextLocked =
          existing.contextLocked || candidate.contextLocked;
        if (!existing.currentRoom && candidate.currentRoom) {
          existing.currentRoom = candidate.currentRoom;
        }
        if (
          typeof candidate.lastInteractionAt === 'number' &&
          candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)
        ) {
          existing.lastInteractionAt = candidate.lastInteractionAt;
        }
      }
    }
    return playersByUser;
  }

  private async attachRooms(
    playersByUser: Map<number, PresenceBroadcastPlayer>,
  ) {
    const userIds = Array.from(playersByUser.keys());
    if (userIds.length === 0) {
      return;
    }
    const participants =
      await this.participants.listActiveRoomsByUserIds(userIds);
    for (const p of participants) {
      const entry = playersByUser.get(p.userId);
      if (!entry || !p.room) {
        continue;
      }
      if (entry.currentRoom === null) {
        entry.currentRoom = { id: p.room.id, name: p.room.name };
      }
      if (!entry.contextLocked) {
        entry.activity = 'table';
      }

      // Enrich: know whether the room has started (affects availability).
      entry.roomStarted =
        String(p.room.status ?? '').toLowerCase() === 'started' ||
        Boolean(p.room.startedAt);
    }
  }

  private broadcast(payload: Record<string, unknown>) {
    const encoded = JSON.stringify(payload);
    for (const { socket } of this.clients.values()) {
      try {
        socket.send(encoded);
      } catch (err) {
        this.logger.warn('Envoi WS échoué', err as Error);
        this.unregister(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private broadcastChat(payload: Record<string, unknown>) {
    const encoded = JSON.stringify(payload);
    for (const { socket, context } of this.clients.values()) {
      if (context !== 'chat') {
        continue;
      }
      try {
        socket.send(encoded);
      } catch (err) {
        this.logger.warn('Envoi WS échoué', err as Error);
        this.unregister(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private emitPresence(
    playersByUser: Map<number, PresenceBroadcastPlayer>,
  ): void {
    const players = this.toPublicPlayers(playersByUser);
    this.playersByOrigin.set(this.instanceId, { at: Date.now(), players });
    this.pruneOrigins();
    const merged = mergePresencePlayersFromOrigins(this.playersByOrigin);
    const enriched = enrichPresencePlayers(
      merged,
      Date.now(),
      this.absentAfterMs,
    );
    this.broadcast({ type: 'presence-update', players: enriched });
    this.transport
      .publish({ players, origin: this.instanceId, at: Date.now() })
      .catch((err) =>
        this.logger.error('Publication presence redis échouée', err),
      );
  }

  private toPublicPlayers(
    playersByUser: Map<number, PresenceBroadcastPlayer>,
  ): PresencePublicPlayer[] {
    return Array.from(playersByUser.values()).map(
      ({ contextLocked: _contextLocked, ...rest }): PresencePublicPlayer =>
        rest,
    );
  }

  private handleExternalPresence(event: PresenceEvent): void {
    if (event.origin === this.instanceId) {
      return;
    }
    const origin = event.origin ?? 'unknown';
    this.playersByOrigin.set(origin, {
      at:
        typeof event.at === 'number' && Number.isFinite(event.at)
          ? event.at
          : Date.now(),
      players: Array.isArray(event.players) ? event.players : [],
    });
    this.pruneOrigins();
    const merged = mergePresencePlayersFromOrigins(this.playersByOrigin);
    const enriched = enrichPresencePlayers(
      merged,
      Date.now(),
      this.absentAfterMs,
    );
    this.broadcast({ type: 'presence-update', players: enriched });
  }

  findClient(socket: WebSocket): PresenceClient | undefined {
    return this.clients.get(socket);
  }

  listPlayers(): PresenceListItem[] {
    this.pruneOrigins();
    const merged = mergePresencePlayersFromOrigins(this.playersByOrigin);
    const enriched = enrichPresencePlayers(
      merged,
      Date.now(),
      this.absentAfterMs,
    );
    return enriched.map((p) => ({
      id: p.id,
      username: p.username,
      activity: p.activity,
      currentRoom: p.currentRoom ?? null,
      lastInteractionAt: p.lastInteractionAt ?? 0,
      roomStarted: p.roomStarted ?? null,
      availability: p.availability,
      location: p.location,
    }));
  }

  private pruneOrigins(): void {
    const now = Date.now();
    for (const [origin, entry] of this.playersByOrigin.entries()) {
      if (
        !entry ||
        typeof entry.at !== 'number' ||
        now - entry.at > this.originTtlMs
      ) {
        this.playersByOrigin.delete(origin);
      }
    }
  }

  private isBinaryPayload(raw: unknown): raw is BinaryPayloadLike {
    return Boolean(raw && typeof raw === 'object' && 'byteLength' in raw);
  }

  private parseIncomingPayload(value: unknown): PresenceIncomingPayload | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    return typeof record.type === 'string'
      ? (record as PresenceIncomingPayload)
      : null;
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(
      () => this.runHeartbeat(),
      this.pingIntervalMs,
    );
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private runHeartbeat() {
    for (const socket of Array.from(this.clients.keys())) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.unregister(socket);
        continue;
      }
      const pongTimeout = setTimeout(() => {
        this.unregister(socket);
        try {
          socket.terminate?.();
        } catch {
          socket.close();
        }
      }, this.pingTimeoutMs);
      try {
        socket.ping();
        socket.once('pong', () => clearTimeout(pongTimeout));
      } catch {
        clearTimeout(pongTimeout);
        this.unregister(socket);
        try {
          socket.terminate?.();
        } catch {
          socket.close();
        }
      }
    }
    // Periodic refresh so "absent" status propagates even without explicit events.
    if (this.clients.size > 0) {
      this.broadcastPresence();
    }
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }
}
