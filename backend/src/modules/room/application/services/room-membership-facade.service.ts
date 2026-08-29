import { Inject, Injectable } from '@nestjs/common';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../ports/room-participant.repository';
import type { RoomRecord } from '../models/room-record.model';
import { CountRoomBotsService } from '../../../bot/public-api';
import { RoomAdminContextService } from './room-admin-context.service';
import { RoomAccessService } from './room-access.service';
import { RoomMembershipService } from './room-membership.service';
import { RoomStateService } from './room-state.service';

@Injectable()
export class RoomMembershipFacadeService {
  constructor(
    @Inject(ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: RoomParticipantRepository,
    private readonly countRoomBotsUseCase: CountRoomBotsService,
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly roomAccess: RoomAccessService,
    private readonly membership: RoomMembershipService,
    private readonly state: RoomStateService,
  ) {}

  private buildContext() {
    return {
      invalidateRoomPayloadCache: this.state.invalidateRoomPayloadCache.bind(
        this.state,
      ),
      requireRoom: this.roomAdminContext.requireRoom.bind(
        this.roomAdminContext,
      ),
      requireUser: this.roomAdminContext.requireUser.bind(
        this.roomAdminContext,
      ),
      countActiveHumans: this.countActiveHumans.bind(this),
      countBots: this.countBots.bind(this),
      leaveAllRoomsForUser: this.leaveAllRoomsForUser.bind(this),
      leaveRoom: this.leaveRoom.bind(this),
      destroyRoom: this.roomAccess.destroyRoom.bind(this.roomAccess),
    };
  }

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    return this.membership.createRoom(
      this.buildContext(),
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
  ): Promise<RoomRecord> {
    return this.membership.joinRoom(this.buildContext(), roomId, userId, opts);
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
  ): Promise<RoomRecord | null> {
    return this.membership.leaveRoom(this.buildContext(), roomId, userId, opts);
  }

  async transferOwnerIfCurrent(roomId: number, userId: number): Promise<void> {
    await this.membership.transferOwnerIfCurrent(
      this.buildContext(),
      roomId,
      userId,
    );
  }

  async leaveAllRoomsForUser(
    userId: number,
    opts?: { exceptRoomId?: number },
  ): Promise<void> {
    await this.membership.leaveAllRoomsForUser(
      this.buildContext(),
      userId,
      opts,
    );
  }

  async findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null> {
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return this.participants.findLatestActiveRoomForUser(userId);
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.countActiveByRoom(roomId);
  }

  private async countBots(roomId: number): Promise<number> {
    return this.countRoomBotsUseCase.execute(roomId);
  }
}
