import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../ports/room-event-publisher.port';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../ports/room-participant.repository';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import type { RoomRecord } from '../models/room-record.model';
import type {
  RoomLeaveOptions,
  RoomMembershipContext,
} from '../models/room-membership-context.model';
export type { RoomMembershipContext } from '../models/room-membership-context.model';
import { PresenceService } from '../../../presence/public-api';
import { CatalogService } from '../../../catalog/public-api';
import { GameStatsService } from '../../../stats/public-api';
import { RoomLeaveService } from './room-leave.service';
import {
  getRoomManifestStatus,
  hasAdminRoomRole,
  isOpenRoom,
  isStartedRoom,
  normalizeExceptRoomId,
  resolveRoomMaxPlayers,
  resolveRoomName,
} from './room-membership.utils';

@Injectable()
export class RoomMembershipService {
  private readonly logger = new Logger(RoomMembershipService.name);

  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: RoomParticipantRepository,
    private readonly presenceService: PresenceService,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
    private readonly roomLeave: RoomLeaveService,
  ) {}

  async createRoom(
    context: RoomMembershipContext,
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    const startedAt = Date.now();
    const owner = await context.requireUser(userId);
    const afterOwnerAt = Date.now();
    if (!gameType || gameType.trim() === '') {
      throw new BadRequestException('Type de jeu requis');
    }

    await context.leaveAllRoomsForUser(userId).catch(() => undefined);

    const gameId = gameType.trim();
    const known =
      (await this.catalog.getGame(gameId)) ??
      ({
        id: gameId,
        name: gameId,
        minPlayers: 2,
        maxPlayers: maxPlayers ?? 4,
        status: 'finished',
      } as NonNullable<Awaited<ReturnType<CatalogService['getGame']>>>);
    const afterCatalogAt = Date.now();
    const status = getRoomManifestStatus(known);
    if (status === 'construction' && !hasAdminRoomRole(owner.roles)) {
      throw new ForbiddenException('Jeu en construction: réservé aux admins');
    }

    const resolvedMaxPlayers = resolveRoomMaxPlayers({
      requestedMaxPlayers: maxPlayers,
      defaultMaxPlayers: known.maxPlayers,
    });

    const room = await this.rooms.createOwnedRoom({
      name: resolveRoomName({ providedName: name, gameType }),
      gameType: gameId,
      maxPlayers: resolvedMaxPlayers,
      isPrivate: isPrivate === true,
      status: 'setup',
      owner,
      createdAt: new Date(),
    });

    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    await this.roomEvents.publishLobbyChanged(room.id, 'created');

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
  ): Promise<RoomRecord> {
    const room = await context.requireRoom(roomId);
    if (room.isPrivate && !opts?.allowPrivate) {
      throw new BadRequestException('Table privée');
    }
    const user = await context.requireUser(userId);

    const manifest = await this.catalog.getGame(room.gameType);
    const status = getRoomManifestStatus(manifest);
    if (status === 'construction' && !hasAdminRoomRole(user.roles)) {
      throw new ForbiddenException('Jeu en construction: réservé aux admins');
    }

    const existing = await this.participants.findActiveByRoomAndUser(
      room.id,
      user.id,
    );

    if (!isOpenRoom(room)) {
      if (existing) {
        await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
        await context.invalidateRoomPayloadCache(room.id);
        this.presenceService.broadcastPresence();
        await this.roomEvents.publishLobbyChanged(room.id, 'joined');
        return room;
      }
      throw new BadRequestException('Table déjà démarrée');
    }

    if (existing) {
      await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });
      await context.invalidateRoomPayloadCache(room.id);
      this.presenceService.broadcastPresence();
      await this.roomEvents.publishLobbyChanged(room.id, 'joined');
      return room;
    }

    const activeHumans = await context.countActiveHumans(room.id);
    const bots = await context.countBots(room.id);
    if (activeHumans + bots >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }

    await context.leaveAllRoomsForUser(userId, { exceptRoomId: room.id });

    const participant = this.participants.create({
      room: { id: room.id, gameType: room.gameType },
      user,
      role: 'player',
      id: 0,
      joinedAt: null,
      leftAt: null,
    });
    await this.participants.save(participant);
    await context.invalidateRoomPayloadCache(room.id);

    if (isStartedRoom(room)) {
      try {
        await this.stats.markQuit(room.id, user.id);
      } catch {
        // best effort
      }
    }

    this.presenceService.broadcastPresence();
    await this.roomEvents.publishLobbyChanged(room.id, 'joined');
    return room;
  }

  async leaveRoom(
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
    opts?: RoomLeaveOptions,
  ): Promise<RoomRecord | null> {
    return this.roomLeave.leave(context, roomId, userId, opts);
  }

  async leaveAllRoomsForUser(
    context: RoomMembershipContext,
    userId: number,
    opts?: { exceptRoomId?: number },
  ): Promise<void> {
    const except = normalizeExceptRoomId(opts?.exceptRoomId);

    const activeParticipations =
      await this.participants.findActiveByUserWithRooms(userId);

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
    const room = await this.rooms.findByIdWithOwner(roomId);
    if (!room?.owner || room.owner.id !== userId) {
      return;
    }

    const next = await this.participants.findFirstActiveByRoomWithUser(room.id);
    if (!next?.user) {
      return;
    }

    room.owner = next.user;
    await this.rooms.save(room);
    await context.invalidateRoomPayloadCache(room.id);
    this.presenceService.broadcastPresence();
    await this.roomEvents.publishLobbyChanged(room.id, 'left');
  }
}
