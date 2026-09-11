import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROOM_PAYLOAD_CACHE,
  type RoomPayloadCachePort,
} from '../../ports/room-payload-cache.port';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../ports/room.repository';
import {
  ROOM_USER_REPOSITORY,
  type RoomUserRepository,
} from '../../ports/room-user.repository';
import type { RoomRecord } from '../../models/room-record.model';
import type { RoomUserRecord } from '../../models/room-user.model';
import {
  ROOM_PRESENCE_PORT,
  type RoomPresencePort,
} from '../../ports/room-presence.port';
import type { RoomAdminContext } from './room-admin-maintenance.service';

@Injectable()
export class RoomAdminContextService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_USER_REPOSITORY)
    private readonly users: RoomUserRepository,
    @Inject(ROOM_PRESENCE_PORT)
    private readonly presenceService: RoomPresencePort,
    @Inject(ROOM_PAYLOAD_CACHE)
    private readonly roomPayloadCache: RoomPayloadCachePort,
  ) {}

  createContext(): RoomAdminContext {
    return {
      invalidateRoomPayloadCache: this.invalidateRoomPayloadCache.bind(this),
      requireRoom: this.requireRoom.bind(this),
      requireUser: this.requireUser.bind(this),
      ensureOwner: this.ensureOwner.bind(this),
      broadcastPresence: () => this.presenceService.broadcastPresence(),
    };
  }

  async invalidateRoomPayloadCache(roomId: number): Promise<void> {
    requirePositiveSafeId(roomId, 'Identifiant de table invalide');
    await this.roomPayloadCache.invalidate(roomId);
  }

  async requireRoom(roomId: number): Promise<RoomRecord> {
    requirePositiveSafeId(roomId, 'Identifiant de table invalide');
    const room = await this.rooms.findByIdWithOwner(roomId);
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    return room;
  }

  async requireUser(userId: number): Promise<RoomUserRecord> {
    requirePositiveSafeId(userId, 'Identifiant utilisateur invalide');
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  ensureOwner(room: RoomRecord, userId: number): void {
    requirePositiveSafeId(userId, 'Identifiant utilisateur invalide');
    requirePositiveSafeId(room?.id, 'Identifiant de table invalide');
    if (!room.owner || room.owner.id !== userId) {
      throw new ForbiddenException(
        'Seul le propriétaire peut effectuer cette action',
      );
    }
  }
}

function requirePositiveSafeId(value: unknown, message: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException(message);
  }
}
/** Room application capability boundary. */
