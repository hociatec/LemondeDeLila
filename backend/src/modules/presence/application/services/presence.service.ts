import { MAX_PRESENCE_PLAYERS_PER_ORIGIN } from '../ports/presence-transport.port';
import { PresenceOrigins } from './presence-origins';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { Inject } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import { getErrorDetails } from '../../../../shared/utils/public-api';
import type {
  PresenceClient,
  PresenceListItem,
} from '../models/presence-client.model';
export type {
  PresenceClientCommand,
  PresenceListItem,
} from '../models/presence-client.model';
import {
  PresenceEvent,
  PresenceTransport,
} from '../ports/presence-transport.port';
import {
  PRESENCE_ROOM_PARTICIPANT_REPOSITORY,
  type PresenceRoomParticipantRepository,
} from '../ports/presence-room-participant.repository';
import { PresenceClientMessageService } from './presence-client-message.service';
import { PresenceHeartbeat } from './presence-heartbeat';
import {
  type PresenceBroadcastPlayer,
  type PresenceConnectionContext,
  type PresencePublicPlayer,
  enrichPresencePlayers,
  mergePresencePlayersFromOrigins,
  scorePresenceActivity,
} from './presence-state.utils';

type PresenceActivity = PresenceConnectionContext;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly clients = new Map<WebSocket, PresenceClient>();
  private readonly origins = new PresenceOrigins(() => this.clock.now());
  private broadcastSequence = 0;
  private readonly clientSequences = new WeakMap<WebSocket, number>();
  private destroyed = false;
  private readonly heartbeat = new PresenceHeartbeat({
    listSockets: () => Array.from(this.clients.keys()),
    unregister: (socket) => this.unregister(socket),
    refreshPresence: () => this.broadcastPresence(),
  });
  private readonly instanceId = randomUUID();
  private readonly absentAfterMs = 3 * 60_000;

  constructor(
    @Inject(PresenceClientMessageService)
    private readonly messages: Pick<
      PresenceClientMessageService,
      'handle' | 'isChatBannedNow' | 'getChatBanInfo' | 'sendHistory'
    >,
    @Inject(PRESENCE_ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: PresenceRoomParticipantRepository,
    private readonly transport: PresenceTransport,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
    @Inject(ApplicationShutdownService)
    private readonly shutdown = new ApplicationShutdownService(),
  ) {
    shutdown.registerSource('presence-heartbeat', () => this.heartbeat.stop());
    this.transport
      .subscribe((event) => this.handleExternalPresence(event))
      .catch((err) =>
        this.logger.error('Impossible de souscrire aux updates presence', err),
      );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.heartbeat.stop();
    for (const socket of this.clients.keys()) {
      try {
        socket.close(1001, 'server shutdown');
      } catch {
        /* Already closed. */
      }
    }
    this.clients.clear();
    const withdrawal = {
      origin: this.instanceId,
      players: [],
      at: this.clock.now(),
      sequence: ++this.broadcastSequence,
    };
    this.origins.accept(withdrawal);
    await this.transport
      .publish(withdrawal)
      .catch((error: unknown) =>
        this.logger.warn(
          'Dernière présence indisponible',
          getErrorDetails(error),
        ),
      );
    await this.transport.disconnect();
  }

  register(
    socket: WebSocket,
    user: WsAuthPayload,
    context: PresenceConnectionContext = 'home',
  ): boolean {
    if (
      this.destroyed ||
      this.shutdown.isDraining ||
      !Number.isSafeInteger(user?.id) ||
      user.id <= 0 ||
      typeof user.username !== 'string' ||
      user.username.length > 255
    ) {
      return false;
    }
    if (this.clients.size >= 10_000 && !this.clients.has(socket)) return false;
    const users = new Set(
      [...this.clients]
        .filter(([existing]) => existing !== socket)
        .map(([, client]) => client.user.id),
    );
    if (!users.has(user.id) && users.size >= MAX_PRESENCE_PLAYERS_PER_ORIGIN)
      return false;
    this.clients.set(socket, {
      socket,
      user,
      context,
      contextLocked: false,
      roomHint: null,
      lastInteractionAt: this.clock.now(),
    });
    if (!this.shutdown.isDraining) this.heartbeat.ensureStarted();
    return true;
  }

  unregister(socket: WebSocket) {
    this.heartbeat.cancel(socket);
    this.clients.delete(socket);
    if (this.clients.size === 0) {
      this.heartbeat.stop();
    }
  }

  handleClientPayload(from: PresenceClient, raw: unknown): Promise<void> {
    return this.messages.handle(from, raw, {
      broadcastChat: (event) => this.broadcast(event, 'chat'),
      presenceChanged: () => this.broadcastPresence(),
      presenceSync: (socket) => this.sendCurrentPresence(socket),
      chatSync: (socket) => this.sendHistory(socket),
    });
  }

  async isChatBannedNow(userId: number): Promise<boolean> {
    return this.messages.isChatBannedNow(userId);
  }

  async getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    return this.messages.getChatBanInfo(userId);
  }

  sendHistory(to: WebSocket): Promise<void> {
    return this.messages.sendHistory(to);
  }

  broadcastPresence() {
    if (this.destroyed || this.shutdown.isDraining) return;
    const sequence = ++this.broadcastSequence;
    const playersByUser = this.collectPlayers();
    void this.shutdown.run(() =>
      this.attachRooms(playersByUser)
        .then(() => this.emitPresence(playersByUser, sequence))
        .catch((err) => {
          this.logger.warn(
            'attachRooms a échoué, diffusion présence sans room enrichie',
            getErrorDetails(err),
          );
          return this.emitPresence(playersByUser, sequence);
        }),
    );
  }

  /**
   * Best-effort check: true if the user has at least one active presence connection in "tavern" context.
   * Used by features that require all players to be available before starting/restoring a table.
   */
  isUserInTavern(userId: number): boolean {
    if (!Number.isSafeInteger(userId) || userId <= 0) return false;
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
        lastInteractionAt: client.lastInteractionAt ?? this.clock.now(),
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

  private broadcast(
    payload: Record<string, unknown>,
    requiredContext?: PresenceConnectionContext,
  ): void {
    const encoded = JSON.stringify(payload);
    if (!encoded || Buffer.byteLength(encoded, 'utf8') > 1_048_576) return;
    for (const { socket, context } of this.clients.values()) {
      if (requiredContext && context !== requiredContext) {
        continue;
      }
      try {
        socket.send(encoded);
      } catch (err) {
        this.logger.warn('Envoi WS échoué', getErrorDetails(err));
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
    sequence: number,
  ): Promise<void> {
    if (sequence !== this.broadcastSequence) return Promise.resolve();
    const players = this.toPublicPlayers(playersByUser);
    const event = {
      players,
      origin: this.instanceId,
      at: this.clock.now(),
      sequence,
    };
    this.origins.accept(event);
    const merged = mergePresencePlayersFromOrigins(this.origins.snapshot());
    const enriched = enrichPresencePlayers(
      merged,
      this.clock.now(),
      this.absentAfterMs,
    );
    this.broadcastPresencePlayers(enriched);
    return this.transport
      .publish(event)
      .catch((err) =>
        this.logger.error('Publication presence redis échouée', err),
      );
  }

  private toPublicPlayers(
    playersByUser: Map<number, PresenceBroadcastPlayer>,
  ): PresencePublicPlayer[] {
    return Array.from(playersByUser.values()).map(
      (player): PresencePublicPlayer => ({
        id: player.id,
        username: player.username,
        activity: player.activity,
        currentRoom: player.currentRoom
          ? { id: player.currentRoom.id, name: player.currentRoom.name }
          : null,
        lastInteractionAt: player.lastInteractionAt,
        roomStarted: player.roomStarted,
      }),
    );
  }

  private handleExternalPresence(event: PresenceEvent): void {
    if (event.origin === this.instanceId) {
      return;
    }
    if (!this.origins.accept(event)) return;
    const merged = mergePresencePlayersFromOrigins(this.origins.snapshot());
    const enriched = enrichPresencePlayers(
      merged,
      this.clock.now(),
      this.absentAfterMs,
    );
    this.broadcastPresencePlayers(enriched);
  }

  private sendCurrentPresence(socket: WebSocket): void {
    const merged = mergePresencePlayersFromOrigins(this.origins.snapshot());
    this.sendPresenceUpdate(
      socket,
      enrichPresencePlayers(merged, this.clock.now(), this.absentAfterMs),
    );
  }

  private broadcastPresencePlayers(players: PresenceListItem[]): void {
    for (const { socket } of this.clients.values()) {
      this.sendPresenceUpdate(socket, players);
    }
  }

  private sendPresenceUpdate(
    socket: WebSocket,
    players: PresenceListItem[],
  ): void {
    const sequence = (this.clientSequences.get(socket) ?? 0) + 1;
    const payload = {
      type: 'presence-update',
      players,
      realtime: {
        streamId: this.instanceId,
        sequence,
        snapshot: true,
      },
    };
    const encoded = JSON.stringify(payload);
    if (Buffer.byteLength(encoded, 'utf8') > 1_048_576) return;
    try {
      socket.send(encoded);
      this.clientSequences.set(socket, sequence);
    } catch (error) {
      this.logger.warn('Envoi WS échoué', getErrorDetails(error));
      this.unregister(socket);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
  }

  findClient(socket: WebSocket): PresenceClient | undefined {
    return this.clients.get(socket);
  }

  listPlayers(): PresenceListItem[] {
    const merged = mergePresencePlayersFromOrigins(this.origins.snapshot());
    const enriched = enrichPresencePlayers(
      merged,
      this.clock.now(),
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
}
