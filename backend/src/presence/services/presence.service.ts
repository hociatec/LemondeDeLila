import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { In, IsNull, Repository } from 'typeorm';
import { PresenceEvent, PresenceTransport } from './presence-transport';
import {
  PresenceChatCommandResult,
  PresenceChatService,
} from './presence-chat.service';

export type PresenceConnectionContext =
  | 'home'
  | 'chat'
  | 'table'
  | 'tavern'
  | 'messaging'
  | 'social'
  | 'stats'
  | 'notifications'
  | 'other';
type PresenceActivity = PresenceConnectionContext;

export type PresenceAvailability = 'available' | 'occupied' | 'absent';

type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
  context: PresenceConnectionContext;
  contextLocked: boolean;
  roomHint: { id: number; name?: string | null } | null;
  lastInteractionAt: number;
};

export type PresenceBroadcastPlayer = {
  id: number;
  username: string;
  currentRoom: { id: number; name: string } | null;
  activity: PresenceActivity;
  contextLocked: boolean;
  lastInteractionAt: number;
  roomStarted: boolean | null;
};
type PresencePublicPlayer = Omit<PresenceBroadcastPlayer, 'contextLocked'> & {
  availability?: PresenceAvailability;
  location?: string;
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
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
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

  async handleClientPayload(from: PresenceClient, raw: any) {
    let textPayload: string;
    if (typeof raw === 'string') {
      textPayload = raw;
    } else if (Buffer.isBuffer(raw)) {
      textPayload = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      textPayload = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return;
    }
    if (textPayload.length > 16_384) {
      this.logger.warn('Message WS trop volumineux, rejeté');
      return;
    }
    let payload: any = null;
    try {
      payload = JSON.parse(textPayload);
    } catch {
      return;
    }
    if (!payload || typeof payload.type !== 'string') {
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

  private async handleChatSend(from: PresenceClient, payload: any) {
    const text = typeof payload.text === 'string' ? payload.text : '';
    const result = await this.chat.sendMessage(from.user, text);
    this.handleChatCommandResult(from.socket, result, (event) =>
      this.broadcastChat(event),
    );
  }

  private async handleChatEdit(from: PresenceClient, payload: any) {
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

  private async handleChatDelete(from: PresenceClient, payload: any) {
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
    if (result.kind === 'ok') {
      onOk(result.event);
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

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private handlePresenceContext(client: PresenceClient, payload: any) {
    const raw =
      typeof payload.context === 'string' ? payload.context.toLowerCase() : '';
    let context: PresenceConnectionContext = 'home';
    if (raw === 'chat') {
      context = 'chat';
    } else if (raw === 'table') {
      context = 'table';
    } else if (raw === 'tavern') {
      context = 'tavern';
    } else if (raw === 'messaging') {
      context = 'messaging';
    } else if (raw === 'social') {
      context = 'social';
    } else if (raw === 'stats') {
      context = 'stats';
    } else if (raw === 'notifications') {
      context = 'notifications';
    } else if (raw === 'other') {
      context = 'other';
    }
    client.context = context;
    client.contextLocked = true;
    if (context === 'table') {
      const roomId = this.parseRoomId(payload.roomId);
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

  private parseRoomId(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
  }

  async sendHistory(to: WebSocket) {
    try {
      const payload = await this.chat.buildChatHistoryPayload();
      to.send(JSON.stringify(payload));
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
      const currentScore = this.scoreActivity(existing.activity);
      const candidateScore = this.scoreActivity(candidate.activity);
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
    const participants = await this.participants.find({
      where: {
        leftAt: IsNull(),
        user: { id: In(userIds) } as any,
      },
      relations: ['room', 'user'],
      order: { joinedAt: 'DESC' },
    });
    for (const p of participants) {
      const entry = playersByUser.get(p.user.id);
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
        String((p.room as any).status ?? '').toLowerCase() === 'started' ||
        Boolean((p.room as any).startedAt);
    }
  }

  private scoreActivity(activity: PresenceActivity): number {
    if (activity === 'table') {
      return 0;
    }
    if (
      activity === 'messaging' ||
      activity === 'social' ||
      activity === 'notifications' ||
      activity === 'other'
    ) {
      return 1;
    }
    if (activity === 'chat') {
      return 2;
    }
    if (activity === 'tavern' || activity === 'stats') {
      return 3;
    }
    return 4; // home (default)
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
    const merged = this.mergePlayersFromOrigins();
    const enriched = this.enrichMergedPlayers(merged);
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
      ({ contextLocked: _contextLocked, ...rest }) => rest,
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
    const merged = this.mergePlayersFromOrigins();
    const enriched = this.enrichMergedPlayers(merged);
    this.broadcast({ type: 'presence-update', players: enriched });
  }

  findClient(socket: WebSocket): PresenceClient | undefined {
    return this.clients.get(socket);
  }

  listPlayers(): PresenceListItem[] {
    this.pruneOrigins();
    const merged = this.mergePlayersFromOrigins();
    const enriched = this.enrichMergedPlayers(merged);
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

  private mergePlayersFromOrigins(): PresencePublicPlayer[] {
    const combined: PresencePublicPlayer[] = [];
    for (const entry of this.playersByOrigin.values()) {
      combined.push(...(entry.players ?? []));
    }

    const byUser = new Map<number, PresencePublicPlayer>();
    for (const p of combined) {
      if (!p || typeof (p as any).id !== 'number') continue;
      const id = (p as any).id as number;
      if (!Number.isFinite(id) || id <= 0) continue;

      const candidate: PresencePublicPlayer = {
        id,
        username: String((p as any).username ?? '').trim() || `user#${id}`,
        activity:
          (String((p as any).activity ?? 'home') as PresenceActivity) ?? 'home',
        currentRoom: (p as any).currentRoom ?? null,
        lastInteractionAt:
          typeof (p as any).lastInteractionAt === 'number' &&
          Number.isFinite((p as any).lastInteractionAt)
            ? (p as any).lastInteractionAt
            : 0,
        roomStarted:
          typeof (p as any).roomStarted === 'boolean'
            ? (p as any).roomStarted
            : null,
      };

      const existing = byUser.get(id);
      if (!existing) {
        byUser.set(id, candidate);
        continue;
      }

      const currentScore = this.scoreActivity(existing.activity);
      const candidateScore = this.scoreActivity(candidate.activity);
      if (candidateScore < currentScore) {
        byUser.set(id, candidate);
        continue;
      }

      if (candidateScore === currentScore) {
        if (!existing.currentRoom && candidate.currentRoom) {
          existing.currentRoom = candidate.currentRoom;
        }
        if (
          typeof candidate.lastInteractionAt === 'number' &&
          candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)
        ) {
          existing.lastInteractionAt = candidate.lastInteractionAt;
        }
        if (existing.roomStarted == null && candidate.roomStarted != null) {
          existing.roomStarted = candidate.roomStarted;
        }
      }
    }

    return Array.from(byUser.values());
  }

  private enrichMergedPlayers(
    players: PresencePublicPlayer[],
  ): PresencePublicPlayer[] {
    const now = Date.now();
    return players.map((p) => {
      const last =
        typeof p.lastInteractionAt === 'number' ? p.lastInteractionAt : 0;
      const availability = this.computeAvailability(
        p.activity,
        p.roomStarted,
        now,
        last,
      );
      const location = this.computeLocation(p.activity, p.currentRoom);
      return { ...p, availability, location };
    });
  }

  private computeAvailability(
    activity: PresenceActivity,
    roomStarted: boolean | null,
    now: number,
    lastInteractionAt: number,
  ): PresenceAvailability {
    if (
      lastInteractionAt > 0 &&
      now - lastInteractionAt >= this.absentAfterMs
    ) {
      return 'absent';
    }

    if (activity === 'table') {
      return roomStarted ? 'occupied' : 'available';
    }

    if (
      activity === 'chat' ||
      activity === 'tavern' ||
      activity === 'stats' ||
      activity === 'home'
    ) {
      return 'available';
    }

    // messaging + other modules: occupied
    return 'occupied';
  }

  private computeLocation(
    activity: PresenceActivity,
    currentRoom: { id: number; name: string } | null,
  ): string {
    if (activity === 'table') {
      return (
        currentRoom?.name ||
        (currentRoom?.id ? `Table #${currentRoom.id}` : 'Table')
      );
    }
    if (activity === 'chat') return 'tchat';
    if (activity === 'tavern') return 'taverne';
    if (activity === 'stats') return 'livre des contes';
    if (activity === 'messaging') return 'messagerie';
    if (activity === 'social') return 'social';
    if (activity === 'notifications') return 'notifications';
    if (activity === 'home') return 'accueil';
    return 'application';
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
