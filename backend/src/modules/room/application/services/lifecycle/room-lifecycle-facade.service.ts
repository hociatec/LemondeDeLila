import { Inject, Injectable } from '@nestjs/common';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../../ports/room-participant.repository';
import type { RoomRecord } from '../../contracts/room-record.model';
import { CountRoomBotsService } from '../../../../bot/public-api';
import { RoomAdminContextService } from '../maintenance/room-admin-context.service';
import { RoomLifecycleService } from './room-lifecycle.service';
import { RoomStateService } from '../state/room-state.service';

@Injectable()
export class RoomLifecycleFacadeService {
  constructor(
    @Inject(ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: RoomParticipantRepository,
    private readonly countRoomBotsUseCase: CountRoomBotsService,
    private readonly roomAdminContext: RoomAdminContextService,
    private readonly lifecycle: RoomLifecycleService,
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
      countActiveHumans: this.countActiveHumans.bind(this),
      countBots: this.countBots.bind(this),
      ensureOwner: this.roomAdminContext.ensureOwner.bind(
        this.roomAdminContext,
      ),
    };
  }

  async togglePrivacy(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    return this.lifecycle.togglePrivacy(
      this.buildContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  async startRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    return this.lifecycle.startRoom(
      this.buildContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  async startRoomSystem(roomId: number): Promise<RoomRecord> {
    return this.lifecycle.startRoomSystem(this.buildContext(), roomId);
  }

  async resetRoom(
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    return this.lifecycle.resetRoom(
      this.buildContext(),
      roomId,
      userId,
      invalidateCache,
    );
  }

  async resetRoomSystem(roomId: number): Promise<RoomRecord> {
    return this.lifecycle.resetRoomSystem(this.buildContext(), roomId);
  }

  async prepareNextRun(roomId: number): Promise<RoomRecord> {
    return this.lifecycle.prepareNextRun(this.buildContext(), roomId);
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.countActiveByRoom(roomId);
  }

  private async countBots(roomId: number): Promise<number> {
    return this.countRoomBotsUseCase.execute(roomId);
  }
}
/** Room application capability boundary. */
