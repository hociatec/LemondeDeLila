import { Injectable } from '@nestjs/common';
import type { RoomGamePort } from '../../application/ports/room-game.port';
import { RoomLifecycleFacadeService } from '../../application/services/lifecycle/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../application/services/membership/room-membership-facade.service';
import { RoomStateService } from '../../application/services/state/room-state.service';

@Injectable()
export class RoomGameAdapter implements RoomGamePort {
  constructor(
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
  ) {}

  getRoomPayload(roomId: number) {
    return this.roomState.getRoomPayload(roomId);
  }

  async resetRoom(roomId: number, userId: number): Promise<void> {
    await this.lifecycle.resetRoom(roomId, userId);
  }

  async startRoom(roomId: number, userId: number): Promise<void> {
    await this.lifecycle.startRoom(roomId, userId);
  }

  async resetRoomSystem(roomId: number): Promise<void> {
    await this.lifecycle.resetRoomSystem(roomId);
  }

  async startRoomSystem(roomId: number): Promise<void> {
    await this.lifecycle.startRoomSystem(roomId);
  }

  async prepareNextRun(roomId: number): Promise<void> {
    await this.lifecycle.prepareNextRun(roomId);
  }

  notifyRoomStateUpdated(roomId: number) {
    return this.roomState.notifyRoomStateUpdated(roomId);
  }

  findLatestActiveRoomForUser(userId: number) {
    return this.membership.findLatestActiveRoomForUser(userId);
  }
}
