import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { RoomPayload } from '../dto/room-response.dto';
import { BotService } from '../../bot/services/bot.service';
import { PresenceService } from '../../presence/services/presence.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import type { Redis } from 'ioredis';
import { RoomRealtimeTrackerService } from './room-realtime-tracker.service';
import { RedisClientFactory } from '../../common/redis/redis-client.factory';

@Injectable()
export class RoomService {
  private realtimeNotifier?: (roomId: number) => Promise<void> | void;
  private roomDeletedNotifier?: (roomId: number) => Promise<void> | void;
  private directoryNotifier?: (
    roomId: number,
    reason: string,
  ) => Promise<void> | void;
  private readonly logger = new Logger(RoomService.name);
  private redis: Redis | null = null;
  private readonly roomPayloadRedisPrefix = 'room:payload:';
  private readonly roomPayloadTtlSeconds: number;
  private readonly roomBans = new Map<number, Set<number>>();

  /**
   * Hook optionnel pour notifier les clients WS room (set par RoomGateway).
   */
  setRealtimeNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.realtimeNotifier = fn;
  }

  /**
   * Hook optionnel pour notifier les clients d'une suppression forcée de table (set par RoomGateway).
   * Permet à l'admin d'effacer une room même avec des joueurs connectés, en les renvoyant à l'accueil.
   */
  setRoomDeletedNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.roomDeletedNotifier = fn;
  }

  /**
   * Hook optionnel pour notifier la "liste des tables publiques" (set par PublicRoomDirectoryBinder).
   */
  setDirectoryNotifier(
    fn: (roomId: number, reason: string) => Promise<void> | void,
  ): void {
    this.directoryNotifier = fn;
  }

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    try {
      await this.realtimeNotifier?.(roomId);
    } catch {
      // best effort
    }
  }

  /**
   * Admin: force delete a room, even if there are active players.
   * The RoomGateway (if present) will disconnect clients for that room.
   */
  async adminDestroyRoom(
    roomId: number,
  ): Promise<{ ok: true; roomId: number }> {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide.');
    }

    const existing = await this.rooms.findOne({
      where: { id },
      select: ['id'],
    });
    if (!existing) {
      throw new NotFoundException('Room introuvable.');
    }

    try {
      await this.roomDeletedNotifier?.(id);
    } catch {
      // best effort
    }

    await this.rooms.delete(id);
    this.roomBans.delete(id);
    await this.invalidateRoomPayloadCache(id);
    this.notifyDirectoryChanged(id, 'deleted');
    this.presenceService.broadcastPresence();
    return { ok: true, roomId: id };
  }

  isBanned(roomId: number, userId: number): boolean {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    const uid =
      typeof userId === 'number' && Number.isFinite(userId) && userId > 0
        ? Math.floor(userId)
        : 0;
    if (id <= 0 || uid <= 0) return false;
    return this.roomBans.get(id)?.has(uid) ?? false;
  }

  ban(roomId: number, userId: number): void {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    const uid =
      typeof userId === 'number' && Number.isFinite(userId) && userId > 0
        ? Math.floor(userId)
        : 0;
    if (id <= 0 || uid <= 0) return;
    const set = this.roomBans.get(id) ?? new Set<number>();
    set.add(uid);
    this.roomBans.set(id, set);
  }

  unban(roomId: number, userId: number): void {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    const uid =
      typeof userId === 'number' && Number.isFinite(userId) && userId > 0
        ? Math.floor(userId)
        : 0;
    if (id <= 0 || uid <= 0) return;
    const set = this.roomBans.get(id);
    if (!set) return;
    set.delete(uid);
    if (set.size === 0) this.roomBans.delete(id);
  }

  async setOwner(roomId: number, userId: number, newOwnerId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    const user = await this.requireUser(newOwnerId);
    room.owner = user;
    await this.rooms.save(room);
    await this.invalidateRoomPayloadCache(room.id);
    this.notifyDirectoryChanged(room.id, 'owner');
    this.presenceService.broadcastPresence();
    return room;
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
    const includePrivate = opts?.includePrivate !== false;
    const joinableOnly = opts?.joinableOnly === true;
    const includeStarted = joinableOnly ? false : opts?.includeStarted === true;
    const limit = Math.min(Math.max(1, opts?.limit ?? 200), 1000);

    const qb = this.rooms
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect(
        'room.participants',
        'participant',
        'participant.leftAt IS NULL',
      )
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('room.bots', 'bot')
      .orderBy('room.id', 'DESC')
      .limit(limit);

    if (!includePrivate) {
      qb.where('room.isPrivate = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!includeStarted) {
      qb.andWhere('room.startedAt IS NULL');
    }

    const rooms = await qb.getMany();
    const items = rooms.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      gameType: r.gameType ?? '',
      status: r.status ?? '',
      isPrivate: Boolean(r.isPrivate),
      maxPlayers: Number(r.maxPlayers ?? 0) || 0,
      playersCount: r.participants?.length ?? 0,
      botsCount: r.bots?.length ?? 0,
      ownerUsername: r.owner?.username ?? null,
      activePlayers: this.realtimeTracker.countActivePlayers(r.id),
    }));

    if (!joinableOnly) {
      return { items };
    }

    const openStatuses = new Set(
      OPEN_ROOM_STATUSES.map((s) => (s ?? '').toLowerCase()),
    );
    return {
      items: items.filter((r) => {
        const status = (r.status ?? '').toLowerCase();
        return openStatuses.has(status) && r.activePlayers > 0;
      }),
    };
  }

  /**
   * Admin: deletes rooms matching criteria (use with caution).
   * Intended to purge stale "open" rooms that still appear in the public directory.
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
    const includePrivate = opts?.includePrivate === true;
    const includeStarted = opts?.includeStarted === true;
    const dryRun = opts?.dryRun === true;
    const excludeActivePlayers = opts?.excludeActivePlayers !== false;
    const limit = Math.min(Math.max(1, opts?.limit ?? 1000), 5000);

    const qb = this.rooms
      .createQueryBuilder('room')
      .select(['room.id'])
      .orderBy('room.id', 'ASC');

    if (!includePrivate) {
      qb.where('room.is_private = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!includeStarted) {
      qb.andWhere('room.started_at IS NULL');
      const statuses = OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
      qb.andWhere('LOWER(room.status) IN (:...statuses)', { statuses });
    }

    const olderThanMinutes =
      typeof opts?.olderThanMinutes === 'number' &&
      Number.isFinite(opts.olderThanMinutes) &&
      opts.olderThanMinutes > 0
        ? Math.floor(opts.olderThanMinutes)
        : null;
    if (olderThanMinutes) {
      const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
      qb.andWhere('room.created_at < :cutoff', { cutoff });
    }

    qb.limit(limit);

    const rows = await qb.getRawMany<{ room_id: number }>();
    const roomIds = rows
      .map((r: any) => Number(r?.room_id ?? r?.id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    const filteredRoomIds = excludeActivePlayers
      ? roomIds.filter((id) => !this.realtimeTracker.hasActivePlayers(id))
      : roomIds;

    if (dryRun) {
      return {
        matched: filteredRoomIds.length,
        deleted: 0,
        roomIds: filteredRoomIds,
      };
    }

    if (filteredRoomIds.length === 0) {
      return { matched: 0, deleted: 0, roomIds: [] };
    }

    // Deleting the room cascades to participants/bots (FK onDelete: CASCADE).
    await this.rooms.delete(filteredRoomIds);
    for (const id of filteredRoomIds) {
      await this.invalidateRoomPayloadCache(id);
      this.notifyDirectoryChanged(id, 'deleted');
    }
    this.presenceService.broadcastPresence();

    return {
      matched: filteredRoomIds.length,
      deleted: filteredRoomIds.length,
      roomIds: filteredRoomIds,
    };
  }

  private notifyDirectoryChanged(roomId: number, reason: string) {
    try {
      void this.directoryNotifier?.(roomId, reason);
    } catch {
      // best effort
    }
  }
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    const ttlCandidate = Number(
      this.config.get('ROOM_PAYLOAD_CACHE_TTL_SECONDS') ?? 15,
    );
    const ttl =
      Number.isFinite(ttlCandidate) && ttlCandidate >= 1 ? ttlCandidate : 15;
    this.roomPayloadTtlSeconds = Math.min(ttl, 3600);
  }

  async primeRoomPayloadCache(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    await this.persistRoomPayload(roomId, payload);
  }

  async invalidateRoomPayloadCache(roomId: number): Promise<void> {
    if (!this.redis) {
      this.ensureRedisInitialized();
    }
    if (!this.redis) return;
    try {
      await this.redis.del(this.roomPayloadKey(roomId));
    } catch {
      // best effort
    }
  }

  async updateRoomPayloadCache(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    if (!this.redis) {
      this.ensureRedisInitialized();
    }
    if (!this.redis) return null;

    try {
      const cached = await this.getCachedRoomPayload(roomId);
      if (!cached) {
        return null;
      }
      const next = updater(cached);
      if (!next) {
        return null;
      }
      await this.persistRoomPayload(roomId, next);
      return next;
    } catch {
      return null;
    }
  }

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ): Promise<Room> {
    const startedAt = Date.now();
    const owner = await this.requireUser(userId);
    const afterOwnerAt = Date.now();
    if (!gameType || gameType.trim() === '') {
      throw new BadRequestException('Type de jeu requis');
    }
    const gameId = gameType.trim();
    const known = await this.catalog.getGame(gameId);
    const afterCatalogAt = Date.now();
    if (!known) {
      throw new BadRequestException('Type de jeu invalide');
    }
    const resolvedMaxPlayers =
      maxPlayers && maxPlayers > 0
        ? maxPlayers
        : known.maxPlayers && known.maxPlayers > 0
          ? known.maxPlayers
          : 4;
    const room = await this.rooms.manager.transaction(async (manager) => {
      const roomRepo = manager.getRepository(Room);
      const participantRepo = manager.getRepository(RoomParticipant);

      const room = roomRepo.create({
        name: name && name.trim() ? name.trim() : `Table ${gameType}`,
        gameType: gameId,
        maxPlayers: resolvedMaxPlayers,
        isPrivate: isPrivate === true,
        status: 'setup',
        owner,
        createdAt: new Date(),
      });
      await roomRepo.save(room);

      const participant = participantRepo.create({
        room,
        user: owner,
        role: 'owner',
      });
      await participantRepo.save(participant);

      return room;
    });
    if (invalidateCache) {
      await this.invalidateRoomPayloadCache(room.id);
    }
    this.notifyDirectoryChanged(room.id, 'created');
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 1500) {
      const now = Date.now();
      this.logger.warn(
        `createRoom lent ${JSON.stringify({
          userId,
          gameType: gameId,
          roomId: room.id,
          ms: elapsedMs,
          stepsMs: {
            requireUser: afterOwnerAt - startedAt,
            catalog: afterCatalogAt - afterOwnerAt,
            transaction: now - afterCatalogAt,
          },
        })}`,
      );
    }
    return room;
  }

  async joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<Room> {
    const room = await this.requireRoom(roomId);
    if (room.isPrivate && !opts?.allowPrivate) {
      throw new BadRequestException('Table privée');
    }
    if (!this.isRoomOpen(room)) {
      throw new BadRequestException('Table déjà démarrée');
    }
    const user = await this.requireUser(userId);
    const activeHumans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    if (activeHumans + bots >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }
    const existing = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: user.id }, leftAt: IsNull() },
    });
    if (!existing) {
      // Fermer toutes les participations actives de l'utilisateur dans d'autres rooms
      await this.closeAllUserParticipations(userId);

      const participant = this.participants.create({
        room,
        user,
        role: 'player',
      });
      await this.participants.save(participant);
    }
    await this.invalidateRoomPayloadCache(room.id);

    if (String(room.status ?? '').toLowerCase() === 'started') {
      try {
        await this.stats.markQuit(room.id, user.id);
      } catch {
        // best effort
      }
    }

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();
    this.notifyDirectoryChanged(room.id, 'joined');

    return room;
  }

  async leaveRoom(
    roomId: number,
    userId: number,
    opts?: {
      preserveRoom?: boolean;
      disconnectOnly?: boolean;
      preserveOwner?: boolean;
    },
  ): Promise<Room | null> {
    const room = await this.requireRoom(roomId);
    const user = await this.requireUser(userId);
    const participant = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: user.id }, leftAt: IsNull() },
    });
    if (opts?.disconnectOnly) {
      this.presenceService.broadcastPresence();
      return room;
    }
    if (participant) {
      participant.leftAt = new Date();
      await this.participants.save(participant);
    }
    await this.invalidateRoomPayloadCache(room.id);

    // Quit explicite d'une partie démarrée = "partie quittée" dans les stats.
    // (Ne pas le faire en mode disconnectOnly, déjà géré plus haut.)
    if (participant && String(room.status ?? '').toLowerCase() === 'started') {
      try {
        await this.stats.markQuit(room.id, user.id);
      } catch {
        // best effort
      }
    }

    // Si le propriétaire quitte, transférer immédiatement au premier joueur humain restant.
    // (On le fait même en preserveRoom=true pour éviter d'avoir une table sans propriétaire.)
    if (
      participant &&
      room.owner &&
      room.owner.id === userId &&
      opts?.preserveOwner !== true
    ) {
      const next = await this.participants.findOne({
        where: { room: { id: room.id }, leftAt: IsNull() },
        relations: ['user'],
        order: { joinedAt: 'ASC' },
      });
      // S'il n'y a plus de joueur humain, on garde le propriétaire actuel
      // (évite une table "sans propriétaire" qui bloquerait start/bots/invites).
      if (next?.user) {
        room.owner = next.user;
        await this.rooms.save(room);
        await this.invalidateRoomPayloadCache(room.id);
      }
    }

    // Remplacer un joueur humain par un bot quand la table est démarrée.
    // Objectif: éviter de poursuivre une partie avec moins de joueurs.
    const started =
      String(room.status ?? '').toLowerCase() === 'started' ||
      Boolean(room.startedAt);
    if (participant && started) {
      try {
        const activeHumans = await this.countActiveHumans(room.id);
        if (activeHumans > 0) {
          await this.botService.addBotSystem(room.id);
          await this.invalidateRoomPayloadCache(room.id);
        }
      } catch {
        // best effort: pas bloquant si aucun nom dispo / table pleine
      }
    }

    if (opts?.preserveRoom) {
      this.presenceService.broadcastPresence();
      this.notifyDirectoryChanged(room.id, 'left');
      return room;
    }

    let activeHumans = await this.countActiveHumans(room.id);
    if (activeHumans === 0) {
      // si aucun humain, on supprime les bots restants pour libérer la table
      await this.botService.removeAllBotsForRoom(room.id);
    }
    activeHumans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    const remaining = activeHumans + bots;
    if (remaining === 0) {
      this.logger.log('Room deleted (empty)', {
        roomId: room.id,
        userId,
        disconnectOnly: opts?.disconnectOnly === true,
        preserveRoom: opts?.preserveRoom === true,
        activeHumans,
        bots,
      });
      try {
        await this.roomDeletedNotifier?.(room.id);
      } catch {
        // best effort
      }
      await this.rooms.delete(room.id);
      this.roomBans.delete(room.id);
      await this.invalidateRoomPayloadCache(room.id);
      // Broadcast la mise à jour de présence en temps réel
      this.presenceService.broadcastPresence();
      this.notifyDirectoryChanged(room.id, 'deleted');
      return null;
    }
    // (Le transfert de propriétaire est géré plus haut, avant preserveRoom.)

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();
    this.notifyDirectoryChanged(room.id, 'left');

    return room;
  }

  async transferOwnerIfCurrent(roomId: number, userId: number): Promise<void> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });
    if (!room?.owner || room.owner.id !== userId) return;

    const next = await this.participants.findOne({
      where: { room: { id: room.id }, leftAt: IsNull() },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
    if (!next?.user) return;
    room.owner = next.user;
    await this.rooms.save(room);
    await this.invalidateRoomPayloadCache(room.id);

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();
    this.notifyDirectoryChanged(room.id, 'left');
  }

  async togglePrivacy(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    room.isPrivate = !room.isPrivate;
    await this.rooms.save(room);
    if (invalidateCache) {
      await this.invalidateRoomPayloadCache(room.id);
    }
    this.notifyDirectoryChanged(room.id, 'privacy');
    return room;
  }

  async startRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    const humans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    if (humans + bots < 2) {
      throw new BadRequestException('Au moins deux participants sont requis');
    }
    room.status = 'started';
    if (!room.startedAt) {
      // Normalise au niveau seconde (MySQL datetime tronque souvent les millisecondes),
      // et incrémente runId pour identifier une nouvelle session de partie de façon fiable.
      room.runId = Math.max(0, Number(room.runId ?? 0)) + 1;
      room.startedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    }
    await this.rooms.save(room);
    if (invalidateCache) {
      await this.invalidateRoomPayloadCache(room.id);
    }
    this.notifyDirectoryChanged(room.id, 'started');

    try {
      const activeParticipants = await this.participants.find({
        where: { room: { id: room.id }, leftAt: IsNull() },
        relations: ['user'],
      });
      // Ne pas bloquer le démarrage côté client sur les écritures statistiques (best-effort).
      void this.stats
        .startMatch({
          roomId: room.id,
          gameType: room.gameType,
          humans: activeParticipants.map((p) => ({
            id: p.user.id,
            username: p.user.username,
          })),
          botsCount: bots,
        })
        .catch(() => undefined);
    } catch {
      // best effort
    }
    return room;
  }

  async resetRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await this.requireRoom(roomId);
    const known = await this.catalog.getGame(room.gameType);
    if (!known) {
      throw new BadRequestException('Type de jeu invalide');
    }
    this.ensureOwner(room, userId);
    if (String(room.status ?? '').toLowerCase() === 'started') {
      try {
        // Best-effort: ne pas ralentir le reset côté client.
        void this.stats.endMatchOnReset(room.id).catch(() => undefined);
      } catch {
        // best effort
      }
    }
    room.status = 'setup';
    room.startedAt = null;
    await this.rooms.save(room);
    if (invalidateCache) {
      await this.invalidateRoomPayloadCache(room.id);
    }
    this.notifyDirectoryChanged(room.id, 'reset');
    return room;
  }

  /**
   * Reset système : utilisé par le moteur quand une partie se termine.
   * Ne dépend pas du propriétaire (l'objectif est de pouvoir relancer immédiatement).
   */
  async resetRoomSystem(roomId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    room.status = 'setup';
    room.startedAt = null;
    await this.rooms.save(room);
    await this.invalidateRoomPayloadCache(room.id);
    this.notifyDirectoryChanged(room.id, 'reset');
    return room;
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    const cached = await this.getCachedRoomPayload(roomId);
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
    await this.persistRoomPayload(roomId, payload);
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

  private isRoomOpen(room: Room): boolean {
    // Robustness: some datasets may have `status` not updated even though `startedAt` is set.
    if (room.startedAt) {
      return false;
    }
    const status = (room.status || '').toLowerCase();
    return OPEN_ROOM_STATUSES.includes(
      status as (typeof OPEN_ROOM_STATUSES)[number],
    );
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.count({
      where: { room: { id: roomId }, leftAt: IsNull() },
    });
  }

  private async countBots(roomId: number): Promise<number> {
    return this.botService.countBotsForRoom(roomId);
  }

  private async closeAllUserParticipations(userId: number): Promise<void> {
    const activeParticipations = await this.participants.find({
      where: { user: { id: userId }, leftAt: IsNull() },
    });
    const now = new Date();
    for (const participation of activeParticipations) {
      participation.leftAt = now;
    }
    if (activeParticipations.length > 0) {
      await this.participants.save(activeParticipations);
    }
  }

  private roomPayloadKey(roomId: number): string {
    return `${this.roomPayloadRedisPrefix}${roomId}`;
  }

  private ensureRedisInitialized(): void {
    if (this.redis) return;
    const redisUrl =
      this.config.get<string>('ROOM_PAYLOAD_REDIS_URL') ??
      this.config.get<string>('SESSION_STORE_REDIS_URL') ??
      null;
    if (!redisUrl) return;
    try {
      this.redis = this.redisFactory.create(redisUrl, 'room-payload-cache');
    } catch {
      this.redis = null;
    }
  }

  private async getCachedRoomPayload(
    roomId: number,
  ): Promise<RoomPayload | null> {
    if (!this.redis) {
      this.ensureRedisInitialized();
    }
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.roomPayloadKey(roomId));
      if (!raw) return null;
      return JSON.parse(raw) as RoomPayload;
    } catch {
      return null;
    }
  }

  private async persistRoomPayload(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    if (!this.redis) {
      this.ensureRedisInitialized();
    }
    if (!this.redis) return;
    try {
      await this.redis.set(
        this.roomPayloadKey(roomId),
        JSON.stringify(payload),
        'EX',
        this.roomPayloadTtlSeconds,
      );
    } catch {
      // best effort
    }
  }
}
