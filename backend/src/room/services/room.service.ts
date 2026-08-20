import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { VaultRoomSnapshotEntity } from '../../vault/entities/vault-room-snapshot.entity';
import { RoomPayload } from '../dto/room-response.dto';
import { BotService } from '../../bot/services/bot.service';
import { PresenceService } from '../../presence/services/presence.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { RoomRealtimeTrackerService } from './room-realtime-tracker.service';
import { RoomAdminMaintenanceService } from './room-admin-maintenance.service';
import { RoomLifecycleService } from './room-lifecycle.service';
import { RoomMembershipService } from './room-membership.service';
import { RoomPayloadCacheService } from './room-payload-cache.service';
import { RoomRuntimeStateService } from './room-runtime-state.service';

@Injectable()
export class RoomService {
  /**
   * Hook optionnel pour notifier les clients WS room (set par RoomGateway).
   */
  setRealtimeNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.runtimeState.setRealtimeNotifier(fn);
  }

  /**
   * Hook optionnel pour notifier les clients d'une suppression forcée de table (set par RoomGateway).
   * Permet à l'admin d'effacer une room même avec des joueurs connectés, en les renvoyant à l'accueil.
   */
  setRoomDeletedNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.runtimeState.addRoomDeletedNotifier(fn);
  }

  /**
   * Hook optionnel pour notifier la "liste du lobby public" (set par RoomLobbyRefreshBinder).
   */
  setLobbyNotifier(
    fn: (roomId: number, reason: string) => Promise<void> | void,
  ): void {
    this.runtimeState.setLobbyNotifier(fn);
  }

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    await this.runtimeState.notifyRoomStateUpdated(roomId);
  }

  /**
   * Admin: force delete a room, even if there are active players.
   * The RoomGateway (if present) will disconnect clients for that room.
   */
  async adminDestroyRoom(
    roomId: number,
  ): Promise<{ ok: true; roomId: number }> {
    return this.adminMaintenance.adminDestroyRoom(
      this.buildAdminContext(),
      roomId,
    );
  }

  isBanned(roomId: number, userId: number): boolean {
    return this.runtimeState.isBanned(roomId, userId);
  }

  ban(roomId: number, userId: number): void {
    this.runtimeState.ban(roomId, userId);
  }

  unban(roomId: number, userId: number): void {
    this.runtimeState.unban(roomId, userId);
  }

  async setOwner(
    roomId: number,
    userId: number,
    newOwnerId: number,
  ): Promise<Room> {
    return this.adminMaintenance.setOwner(
      this.buildAdminContext(),
      roomId,
      userId,
      newOwnerId,
    );
  }

  /**
   * Internal gateway helper: fetch a room and verify ownership.
   */
  async requireRoomForOwnerAction(
    roomId: number,
    userId: number,
  ): Promise<Room> {
    return this.adminMaintenance.requireRoomForOwnerAction(
      this.buildAdminContext(),
      roomId,
      userId,
    );
  }

  /**
   * Internal gateway helper: persist a room and invalidate payload cache.
   */
  async saveRoom(room: Room): Promise<Room> {
    return this.adminMaintenance.saveRoom(this.buildAdminContext(), room);
  }

  /**
   * Admin: list rooms (public and/or private), optionally including started rooms.
   * Intended for maintenance tooling in the admin UI.
   */
  async adminListRooms(opts?: {
    limit?: number;
    includePrivate?: boolean;
    includeStarted?: boolean;
    joinableOnly?: boolean;
  }): Promise<{
    items: Array<{
      id: number;
      name: string;
      gameType: string;
      status: string;
      isPrivate: boolean;
      maxPlayers: number;
      playersCount: number;
      botsCount: number;
      ownerUsername: string | null;
      activePlayers: number;
    }>;
  }> {
    return this.adminMaintenance.adminListRooms(opts);
  }

  /**
   * Admin: deletes rooms matching criteria (use with caution).
   * Intended to purge stale "open" rooms that still appear in the public lobby.
   */
  async adminCleanupRooms(opts?: {
    includePrivate?: boolean;
    includeStarted?: boolean;
    olderThanMinutes?: number;
    limit?: number;
    dryRun?: boolean;
    excludeActivePlayers?: boolean;
  }): Promise<{
    matched: number;
    deleted: number;
    roomIds: number[];
  }> {
    return this.adminMaintenance.adminCleanupRooms(
      this.buildAdminContext(),
      opts,
    );
  }

  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(VaultRoomSnapshotEntity)
    private readonly vaultSnapshots: Repository<VaultRoomSnapshotEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly adminMaintenance: RoomAdminMaintenanceService,
    private readonly lifecycle: RoomLifecycleService,
    private readonly membership: RoomMembershipService,
    private readonly roomPayloadCache: RoomPayloadCacheService,
    private readonly runtimeState: RoomRuntimeStateService,
  ) {}

  private buildAdminContext() {
    return {
      invalidateRoomPayloadCache: this.invalidateRoomPayloadCache.bind(this),
      requireRoom: this.requireRoom.bind(this),
      requireUser: this.requireUser.bind(this),
      ensureOwner: this.ensureOwner.bind(this),
      broadcastPresence: () => this.presenceService.broadcastPresence(),
    };
  }

  private buildMembershipContext() {
    return {
      invalidateRoomPayloadCache: this.invalidateRoomPayloadCache.bind(this),
      requireRoom: this.requireRoom.bind(this),
      requireUser: this.requireUser.bind(this),
      countActiveHumans: this.countActiveHumans.bind(this),
      countBots: this.countBots.bind(this),
      leaveAllRoomsForUser: this.leaveAllRoomsForUser.bind(this),
      leaveRoom: this.leaveRoom.bind(this),
      adminDestroyRoom: this.adminDestroyRoom.bind(this),
    };
  }

  private buildLifecycleContext() {
    return {
      invalidateRoomPayloadCache: this.invalidateRoomPayloadCache.bind(this),
      requireRoom: this.requireRoom.bind(this),
      countActiveHumans: this.countActiveHumans.bind(this),
      countBots: this.countBots.bind(this),
      ensureOwner: this.ensureOwner.bind(this),
    };
  }

  async primeRoomPayloadCache(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    await this.roomPayloadCache.prime(roomId, payload);
  }

  async invalidateRoomPayloadCache(roomId: number): Promise<void> {
    await this.roomPayloadCache.invalidate(roomId);
  }

  async updateRoomPayloadCache(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    return this.roomPayloadCache.update(roomId, updater);
  }

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ): Promise<Room> {
    return this.membership.createRoom(
      this.buildMembershipContext(),
      userId,
      gameType,
      name,
      maxPlayers,
      isPrivate,
      invalidateCache,
    );
  }

  async joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<Room> {
    return this.membership.joinRoom(
      this.buildMembershipContext(),
      roomId,
      userId,
      opts,
    );
  }

  async leaveRoom(
    roomId: number,
    userId: number,
    opts?: {
      preserveRoom?: boolean;
      disconnectOnly?: boolean;
      preserveOwner?: boolean;
      replaceWithBot?: boolean;
    },
  ): Promise<Room | null> {
    return this.membership.leaveRoom(
      this.buildMembershipContext(),
      roomId,
      userId,
      opts,
    );
  }

  async transferOwnerIfCurrent(roomId: number, userId: number): Promise<void> {
    await this.membership.transferOwnerIfCurrent(
      this.buildMembershipContext(),
      roomId,
      userId,
    );
  }

  async togglePrivacy(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    return this.lifecycle.togglePrivacy(
      this.buildLifecycleContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  async startRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    return this.lifecycle.startRoom(
      this.buildLifecycleContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  /**
   * Démarrage système: utilisé par les raccourcis clavier côté moteur.
   * Ne dépend pas du propriétaire.
   */
  async startRoomSystem(roomId: number): Promise<Room> {
    return this.lifecycle.startRoomSystem(
      this.buildLifecycleContext(),
      roomId,
    );
  }

  async resetRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    return this.lifecycle.resetRoom(
      this.buildLifecycleContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  /**
   * Reset système : utilisé par le moteur quand une partie se termine.
   * Ne dépend pas du propriétaire (l'objectif est de pouvoir relancer immédiatement).
   */
  async resetRoomSystem(roomId: number): Promise<Room> {
    return this.lifecycle.resetRoomSystem(
      this.buildLifecycleContext(),
      roomId,
    );
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    const cached = await this.roomPayloadCache.get(roomId);
    if (cached) {
      return cached;
    }
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner', 'participants', 'participants.user', 'bots'],
    });
    if (!room) {
      throw new NotFoundException('Room introuvable');
    }
    const payload = await this.toPayload(room);
    await this.roomPayloadCache.persist(roomId, payload);
    return payload;
  }

  private async toPayload(room: Room): Promise<RoomPayload> {
    const manifest = await this.catalog.getGame(room.gameType);
    return {
      manifest: manifest
        ? {
            id: manifest.id,
            name: manifest.name,
            minPlayers: manifest.minPlayers ?? 2,
            maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
            chatEnabled: manifest.chatEnabled !== false,
            chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
          }
        : null,
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: room.gameType,
        startedAt: room.startedAt ? room.startedAt.toISOString() : null,
        runId:
          typeof (room as any).runId === 'number' ? (room as any).runId : null,
        tableAmbienceSoundId:
          typeof (room as any).tableAmbienceSoundId === 'string'
            ? String((room as any).tableAmbienceSoundId).trim() || null
            : null,
        counts: {
          players: (room.participants || []).filter((p) => !p.leftAt).length,
          spectators: 0,
        },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players: (room.participants || [])
          .filter((p) => !p.leftAt)
          .map((p) => ({ id: p.user.id, username: p.user.username })),
        spectators: [],
        bots: (room.bots || []).map((b) => ({ id: b.id, name: b.name })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async requireRoom(roomId: number): Promise<Room> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    return room;
  }

  private async requireUser(userId: number): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private ensureOwner(room: Room, userId: number) {
    if (!room.owner || room.owner.id !== userId) {
      throw new ForbiddenException(
        'Seul le propriétaire peut effectuer cette action',
      );
    }
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.count({
      where: { room: { id: roomId }, leftAt: IsNull() },
    });
  }

  private async countBots(roomId: number): Promise<number> {
    return this.botService.countBotsForRoom(roomId);
  }

  /**
   * Quand un utilisateur rejoint/crée une nouvelle table, il ne doit plus être "présent"
   * sur une précédente table. On applique donc un leave complet (transfert owner / suppression)
   * plutôt qu'un simple `leftAt` (sinon la table reste dans un état incohérent).
   */
  async leaveAllRoomsForUser(
    userId: number,
    opts?: { exceptRoomId?: number },
  ): Promise<void> {
    await this.membership.leaveAllRoomsForUser(
      this.buildMembershipContext(),
      userId,
      opts,
    );
  }

  /**
   * Best-effort helper for WS/game clients that connect early ("warm") and
   * later start sending actions without having called `game.join`.
   *
   * Returns the most recently joined active room for the user, prioritizing a started game.
   */
  async findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null> {
    if (!Number.isFinite(userId) || userId <= 0) return null;

    const startedParticipation = await this.participants
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.room', 'r')
      .where('p.user_id = :userId', { userId })
      .andWhere('p.left_at IS NULL')
      .andWhere('(r.started_at IS NOT NULL OR LOWER(r.status) = :started)', {
        started: 'started',
      })
      .orderBy('p.joined_at', 'DESC')
      .getOne();

    const p =
      startedParticipation ??
      (await this.participants.findOne({
        where: { user: { id: userId }, leftAt: IsNull() },
        relations: ['room'],
        order: { joinedAt: 'DESC' },
      }));

    const roomId = p?.room?.id ?? 0;
    const gameType = String(p?.room?.gameType ?? '').trim();
    if (!Number.isFinite(roomId) || roomId <= 0) return null;
    if (!gameType) return null;
    return { roomId, gameType };
  }

}
