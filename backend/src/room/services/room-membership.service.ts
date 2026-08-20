import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { VaultRoomSnapshotEntity } from '../../vault/entities/vault-room-snapshot.entity';
import { AddSystemBotToRoomService } from '../../bot/application/use-cases/bot-rooms/add-system-bot-to-room.service';
import { RemoveAllRoomBotsService } from '../../bot/application/use-cases/bot-rooms/remove-all-room-bots.service';
import { PresenceService } from '../../presence/services/presence.service';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { RoomRuntimeStateService } from './room-runtime-state.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';

export type RoomMembershipContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<Room>;
  requireUser: (userId: number) => Promise<User>;
  countActiveHumans: (roomId: number) => Promise<number>;
  countBots: (roomId: number) => Promise<number>;
  leaveAllRoomsForUser: (
    userId: number,
    opts?: { exceptRoomId?: number },
  ) => Promise<void>;
  leaveRoom: (
    roomId: number,
    userId: number,
    opts?: {
      preserveRoom?: boolean;
      disconnectOnly?: boolean;
      preserveOwner?: boolean;
      replaceWithBot?: boolean;
    },
  ) => Promise<Room | null>;
  adminDestroyRoom: (roomId: number) => Promise<{ ok: true; roomId: number }>;
};

@Injectable()
export class RoomMembershipService {
  private readonly logger = new Logger(RoomMembershipService.name);

  constructor(
    private readonly rooms: Repository<Room>,
    private readonly participants: Repository<RoomParticipant>,
    private readonly vaultSnapshots: Repository<VaultRoomSnapshotEntity>,
    private readonly addSystemBotToRoom: AddSystemBotToRoomService,
    private readonly removeAllRoomBots: RemoveAllRoomBotsService,
    private readonly presenceService: PresenceService,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    private readonly runtimeState: RoomRuntimeStateService,
  ) {}

  private static isAdminRoles(roles: unknown): boolean {
    const list = Array.isArray(roles) ? roles : [];
    return list.includes('ROLE_ADMIN') || list.includes('admin');
  }

  async createRoom(
    context: RoomMembershipContext,
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ): Promise<Room> {
    const startedAt = Date.now();
    const owner = await context.requireUser(userId);
    const afterOwnerAt = Date.now();
    if (!gameType || gameType.trim() === '') {
      throw new BadRequestException('Type de jeu requis');
    }

    await context.leaveAllRoomsForUser(userId).catch(() => undefined);

    const gameId = gameType.trim();
    const known = await this.catalog.getGame(gameId);
    const afterCatalogAt = Date.now();
    if (!known) {
      throw new BadRequestException('Type de jeu invalide');
    }
    const status = String((known as any)?.status ?? 'finished').toLowerCase();
    if (
      status === 'construction' &&
      !RoomMembershipService.isAdminRoles(owner.roles)
    ) {
      throw new ForbiddenException('Jeu en construction: réservé aux admins');
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

      const createdRoom = roomRepo.create({
        name: name && name.trim() ? name.trim() : `Table ${gameType}`,
        gameType: gameId,
        maxPlayers: resolvedMaxPlayers,
        isPrivate: isPrivate === true,
        status: 'setup',
        owner,
        createdAt: new Date(),
      });
      await roomRepo.save(createdRoom);

      const participant = participantRepo.create({
        room: createdRoom,
        user: owner,
        role: 'owner',
      });
      await participantRepo.save(participant);

      return createdRoom;
    });

    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    this.runtimeState.notifyLobbyChanged(room.id, 'created');

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
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<Room> {
    const room = await context.requireRoom(roomId);
    if (room.isPrivate && !opts?.allowPrivate) {
      throw new BadRequestException('Table privée');
    }
    const user = await context.requireUser(userId);

    const manifest = await this.catalog.getGame(room.gameType);
    const status = String(
      (manifest as any)?.status ?? 'finished',
    ).toLowerCase();
    if (
      status === 'construction' &&
      !RoomMembershipService.isAdminRoles(user.roles)
    ) {
      throw new ForbiddenException('Jeu en construction: réservé aux admins');
    }

    const existing = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: user.id }, leftAt: IsNull() },
    });

    if (!this.isRoomOpen(room)) {
      if (existing) {
        await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
        await context.invalidateRoomPayloadCache(room.id);
        this.presenceService.broadcastPresence();
        this.runtimeState.notifyLobbyChanged(room.id, 'joined');
        return room;
      }
      throw new BadRequestException('Table déjà démarrée');
    }

    if (existing) {
      await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
      await context.invalidateRoomPayloadCache(room.id);
      this.presenceService.broadcastPresence();
      this.runtimeState.notifyLobbyChanged(room.id, 'joined');
      return room;
    }

    const activeHumans = await context.countActiveHumans(room.id);
    const bots = await context.countBots(room.id);
    if (activeHumans + bots >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }

    await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });

    const participant = this.participants.create({
      room,
      user,
      role: 'player',
    });
    await this.participants.save(participant);
    await context.invalidateRoomPayloadCache(room.id);

    if (String(room.status ?? '').toLowerCase() === 'started') {
      try {
        await this.stats.markQuit(room.id, user.id);
      } catch {
        // best effort
      }
    }

    this.presenceService.broadcastPresence();
    this.runtimeState.notifyLobbyChanged(room.id, 'joined');
    return room;
  }

  async leaveRoom(
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
    opts?: {
      preserveRoom?: boolean;
      disconnectOnly?: boolean;
      preserveOwner?: boolean;
      replaceWithBot?: boolean;
    },
  ): Promise<Room | null> {
    const room = await context.requireRoom(roomId);
    const user = await context.requireUser(userId);
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
    await context.invalidateRoomPayloadCache(room.id);

    if (
      participant &&
      opts?.disconnectOnly !== true &&
      room.restoredFromSnapshotId &&
      room.restoredOwnerUserId === userId
    ) {
      const activeHumansAfterLeave = await context.countActiveHumans(room.id);
      if (activeHumansAfterLeave === 0) {
        const snapshotId = String(room.restoredFromSnapshotId ?? '').trim();
        this.logger.log(
          'Restored room abandoned (no humans left => delete room)',
          {
            roomId: room.id,
            userId,
            snapshotId: snapshotId || null,
          },
        );
        if (snapshotId) {
          try {
            await this.vaultSnapshots.delete({
              id: snapshotId,
              ownerUserId: userId,
            } as any);
          } catch {
            // best effort
          }
        }
        await context.adminDestroyRoom(room.id);
        return null;
      }
    }

    if (participant && String(room.status ?? '').toLowerCase() === 'started') {
      try {
        await this.stats.markQuit(room.id, user.id);
      } catch {
        // best effort
      }
    }

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
      if (next?.user) {
        room.owner = next.user;
        await this.rooms.save(room);
        await context.invalidateRoomPayloadCache(room.id);
      }
    }

    const started =
      String(room.status ?? '').toLowerCase() === 'started' ||
      Boolean(room.startedAt);
    if (participant && started && opts?.replaceWithBot !== false) {
      try {
        const activeHumans = await context.countActiveHumans(room.id);
        if (activeHumans > 0) {
          await this.addSystemBotToRoom.execute(room.id);
          await context.invalidateRoomPayloadCache(room.id);
        }
      } catch {
        // best effort
      }
    }

    if (opts?.preserveRoom) {
      this.presenceService.broadcastPresence();
      this.runtimeState.notifyLobbyChanged(room.id, 'left');
      return room;
    }

    let activeHumans = await context.countActiveHumans(room.id);
    if (activeHumans === 0) {
      await this.removeAllRoomBots.execute(room.id);
    }
    activeHumans = await context.countActiveHumans(room.id);
    const bots = await context.countBots(room.id);
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
      for (const notify of this.runtimeState.getRoomDeletedNotifiers()) {
        try {
          await notify(room.id);
        } catch {
          // best effort
        }
      }
      await this.rooms.delete(room.id);
      this.runtimeState.clearRoomBans(room.id);
      await context.invalidateRoomPayloadCache(room.id);
      this.presenceService.broadcastPresence();
      this.runtimeState.notifyLobbyChanged(room.id, 'deleted');
      return null;
    }

    this.presenceService.broadcastPresence();
    this.runtimeState.notifyLobbyChanged(room.id, 'left');
    return room;
  }

  async leaveAllRoomsForUser(
    context: RoomMembershipContext,
    userId: number,
    opts?: { exceptRoomId?: number },
  ): Promise<void> {
    const except =
      typeof opts?.exceptRoomId === 'number' &&
      Number.isFinite(opts.exceptRoomId) &&
      opts.exceptRoomId > 0
        ? Math.floor(opts.exceptRoomId)
        : 0;

    const activeParticipations = await this.participants.find({
      where: { user: { id: userId }, leftAt: IsNull() },
      relations: ['room'],
    });

    for (const participation of activeParticipations) {
      const roomId = participation?.room?.id ?? 0;
      if (!Number.isFinite(roomId) || roomId <= 0) {
        continue;
      }
      if (except > 0 && roomId === except) {
        continue;
      }

      try {
        await context.leaveRoom(roomId, userId, {
          preserveRoom: false,
          disconnectOnly: false,
        });
      } catch {
        // best effort
      }
    }
  }

  async transferOwnerIfCurrent(
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
  ): Promise<void> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });
    if (!room?.owner || room.owner.id !== userId) {
      return;
    }

    const next = await this.participants.findOne({
      where: { room: { id: room.id }, leftAt: IsNull() },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
    if (!next?.user) {
      return;
    }

    room.owner = next.user;
    await this.rooms.save(room);
    await context.invalidateRoomPayloadCache(room.id);
    this.presenceService.broadcastPresence();
    this.runtimeState.notifyLobbyChanged(room.id, 'left');
  }

  private isRoomOpen(room: Room): boolean {
    if (room.startedAt) {
      return false;
    }
    const status = (room.status || '').toLowerCase();
    return OPEN_ROOM_STATUSES.includes(
      status as (typeof OPEN_ROOM_STATUSES)[number],
    );
  }
}
