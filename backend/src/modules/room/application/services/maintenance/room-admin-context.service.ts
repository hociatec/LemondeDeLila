import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
import type { RoomRecord } from '../../contracts/room-record.model';
import type { RoomUserRecord } from '../../contracts/room-user.model';
import { PresenceService } from '../../../../presence/public-api';
import type { RoomAdminContext } from './room-admin-maintenance.service';

@Injectable()
export class RoomAdminContextService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_USER_REPOSITORY)
    private readonly users: RoomUserRepository,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
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
    await this.roomPayloadCache.invalidate(roomId);
  }

  async requireRoom(roomId: number): Promise<RoomRecord> {
    const room = await this.rooms.findByIdWithOwner(roomId);
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    return room;
  }

  async requireUser(userId: number): Promise<RoomUserRecord> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  ensureOwner(room: RoomRecord, userId: number): void {
    if (!room.owner || room.owner.id !== userId) {
      throw new ForbiddenException(
        'Seul le propriétaire peut effectuer cette action',
      );
    }
  }
}
/** Room application capability boundary. */
