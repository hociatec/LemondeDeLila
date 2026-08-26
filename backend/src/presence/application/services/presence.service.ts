import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { Inject } from '@nestjs/common';
import type { WsAuthPayload } from '../../../common/interfaces/public-api';
import { getErrorDetails } from '../../../common/utils/public-api';
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
  private readonly playersByOrigin = new Map<
    string,
    { at: number; players: PresencePublicPlayer[] }
  >();
  private readonly heartbeat = new PresenceHeartbeat({
    listSockets: () => Array.from(this.clients.keys()),
    unregister: (socket) => this.unregister(socket),
    refreshPresence: () => this.broadcastPresence(),
  });
  private readonly instanceId = randomUUID();
  private readonly originTtlMs = 120_000;
  private readonly absentAfterMs = 3 * 60_000;

  constructor(
    private readonly messages: PresenceClientMessageService,
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
    this.heartbeat.stop();
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
    this.heartbeat.ensureStarted();
  }

  unregister(socket: WebSocket) {
    this.clients.delete(socket);
    if (this.clients.size === 0) {
      this.heartbeat.stop();
    }
  }

  handleClientPayload(from: PresenceClient, raw: unknown): Promise<void> {
    return this.messages.handle(from, raw, {
      broadcastChat: (event) => this.broadcast(event, 'chat'),
      presenceChanged: () => this.broadcastPresence(),
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
    const playersByUser = this.collectPlayers();
    this.attachRooms(playersByUser)
      .then(() => this.emitPresence(playersByUser))
      .catch((err) => {
        this.logger.warn(
          'attachRooms a échoué, diffusion présence sans room enrichie',
          getErrorDetails(err),
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

  private broadcast(
    payload: Record<string, unknown>,
    requiredContext?: PresenceConnectionContext,
  ): void {
    const encoded = JSON.stringify(payload);
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
}
