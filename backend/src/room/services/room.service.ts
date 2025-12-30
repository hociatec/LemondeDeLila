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

@Injectable()
export class RoomService {
  private realtimeNotifier?: (roomId: number) => Promise<void> | void;
  private readonly logger = new Logger(RoomService.name);
  private redis: Redis | null = null;
  private readonly roomPayloadRedisPrefix = 'room:payload:';
  private readonly roomPayloadTtlSeconds = 3;

  /**
   * Hook optionnel pour notifier les clients WS room (set par RoomGateway).
   */
  setRealtimeNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.realtimeNotifier = fn;
  }

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    try {
      await this.realtimeNotifier?.(roomId);
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
    private readonly config: ConfigService,
  ) {}

  async primeRoomPayloadCache(roomId: number, payload: RoomPayload): Promise<void> {
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

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
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
    await this.invalidateRoomPayloadCache(room.id);
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

    return room;
  }

  async leaveRoom(
    roomId: number,
    userId: number,
    opts?: { preserveRoom?: boolean; disconnectOnly?: boolean },
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
    if (opts?.preserveRoom) {
      this.presenceService.broadcastPresence();
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
      await this.rooms.delete(room.id);
      await this.invalidateRoomPayloadCache(room.id);
      // Broadcast la mise à jour de présence en temps réel
      this.presenceService.broadcastPresence();
      return null;
    }
    if (room.owner && room.owner.id === userId) {
      const next = await this.participants.findOne({
        where: { room: { id: room.id }, leftAt: IsNull() },
        relations: ['user'],
        order: { joinedAt: 'ASC' },
      });
      if (next?.user) {
        room.owner = next.user;
        await this.rooms.save(room);
      } else {
        room.owner = null;
        await this.rooms.save(room);
      }
    }

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();

    return room;
  }

  async togglePrivacy(roomId: number, userId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    room.isPrivate = !room.isPrivate;
    await this.rooms.save(room);
    await this.invalidateRoomPayloadCache(room.id);
    return room;
  }

  async startRoom(roomId: number, userId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    const humans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    if (humans + bots < 2) {
      throw new BadRequestException('Au moins deux participants sont requis');
    }
    room.status = 'started';
    room.startedAt = room.startedAt ?? new Date();
    await this.rooms.save(room);
    await this.invalidateRoomPayloadCache(room.id);

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

  async resetRoom(roomId: number, userId: number): Promise<Room> {
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
    await this.invalidateRoomPayloadCache(room.id);
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
      process.env.ROOM_PAYLOAD_REDIS_URL ??
      process.env.SESSION_STORE_REDIS_URL ??
      null;
    if (!redisUrl) return;
    try {
      const RedisCtor = require('ioredis');
      const redisInstance = new RedisCtor(redisUrl);
      redisInstance.on('error', (error: Error) => {
        this.logger.error('Erreur Redis (room payload cache)', error);
      });
      this.redis = redisInstance;
    } catch {
      this.redis = null;
    }
  }

  private async getCachedRoomPayload(roomId: number): Promise<RoomPayload | null> {
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
