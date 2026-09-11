import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { businessMsToDate } from '@shared/utils/public-api';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../../ports/room-event-publisher.port';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../../ports/room-participant.repository';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../ports/room.repository';
import type { RoomRecord } from '../../models/room-record.model';
import type { RoomCreateCommand } from '../../models/room-create-command';
import type {
  RoomLeaveOptions,
  RoomMembershipContext,
} from '../../models/room-membership-context.model';
export type { RoomMembershipContext } from '../../models/room-membership-context.model';
import {
  ROOM_PRESENCE_PORT,
  type RoomPresencePort,
} from '../../ports/room-presence.port';
import {
  ROOM_CATALOG_PORT,
  type RoomCatalogPort,
} from '../../ports/room-catalog.port';
import {
  ROOM_STATS_PORT,
  type RoomStatsPort,
} from '../../ports/room-stats.port';
import { bestEffort } from '../../../../../platform/observability/public-api';
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
    @Inject(ROOM_PRESENCE_PORT)
    private readonly presenceService: RoomPresencePort,
    @Inject(ROOM_CATALOG_PORT)
    private readonly catalog: RoomCatalogPort,
    @Inject(ROOM_STATS_PORT)
    private readonly stats: RoomStatsPort,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
    private readonly roomLeave: RoomLeaveService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async createRoom(
    context: RoomMembershipContext,
    command: RoomCreateCommand,
  ): Promise<RoomRecord> {
    const {
      userId,
      gameType,
      name,
      maxPlayers,
      isPrivate = false,
      invalidateCache = true,
    } = command;
    validateCreateRoomInput(userId, gameType, maxPlayers);
    const startedAt = this.now();
    const owner = await context.requireUser(userId);
    const afterOwnerAt = this.now();
    if (!gameType || gameType.trim() === '') {
      throw new BadRequestException('Type de jeu requis');
    }
    await bestEffort(
      context.leaveAllRoomsForUser(userId),
      `sortie des anciennes rooms user=${userId}`,
      this.logger,
    );

    const gameId = gameType.trim();
    const known = (await this.catalog.getGame(gameId)) ?? {
      id: gameId,
      name: gameId,
      minPlayers: 2,
      maxPlayers: maxPlayers ?? 4,
      status: 'finished',
    };
    const afterCatalogAt = this.now();
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
      createdAt: businessMsToDate(this.now()),
    });
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    await this.roomEvents.publishLobbyChanged(room.id, 'created');

    const elapsedMs = this.now() - startedAt;
    if (elapsedMs >= 1500) {
      const now = this.now();
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
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new BadRequestException(
        'Identifiant de table ou utilisateur invalide',
      );
    }
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

    if (!isOpenRoom(room) && !existing) {
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
    if (!isPositiveSafeId(roomId) || !isPositiveSafeId(userId)) {
      throw new BadRequestException(
        'Identifiant de table ou utilisateur invalide',
      );
    }
    return this.roomLeave.leave(context, roomId, userId, opts);
  }

  async leaveAllRoomsForUser(
    context: RoomMembershipContext,
    userId: number,
    opts?: { exceptRoomId?: number },
  ): Promise<void> {
    if (!isPositiveSafeId(userId)) return;
    const except = normalizeExceptRoomId(opts?.exceptRoomId);

    const activeParticipations =
      await this.participants.findActiveByUserWithRooms(userId);

    const roomIds = [
      ...new Set(
        activeParticipations
          .map((participation) => participation?.room?.id ?? 0)
          .filter((roomId) => isPositiveSafeId(roomId) && roomId !== except),
      ),
    ].slice(0, 1_000);
    await Promise.allSettled(
      roomIds.map((roomId) =>
        context.leaveRoom(roomId, userId, {
          preserveRoom: false,
          disconnectOnly: false,
        }),
      ),
    );
  }

  async transferOwnerIfCurrent(
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
  ): Promise<void> {
    if (!isPositiveSafeId(roomId) || !isPositiveSafeId(userId)) return;
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

  private now(): number {
    return this.clock.now();
  }
}

function isPositiveSafeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validateCreateRoomInput(
  userId: number,
  gameType: string,
  maxPlayers?: number | null,
): void {
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    typeof gameType !== 'string' ||
    !gameType.trim() ||
    gameType.length > 128 ||
    (maxPlayers !== undefined &&
      maxPlayers !== null &&
      (!Number.isSafeInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 64))
  ) {
    throw new BadRequestException('Parametres de table invalides');
  }
}
/** Room application capability boundary. */
