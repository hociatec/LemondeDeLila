import { Inject, Injectable } from '@nestjs/common';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../../ports/room-event-publisher.port';
import type { RoomPayload } from '../../contracts/room-payload.model';
import { RoomPayloadService } from './room-payload.service';
import { RoomRuntimeStateService } from './room-runtime-state.service';

@Injectable()
export class RoomStateService {
  constructor(
    private readonly payloads: RoomPayloadService,
    private readonly runtimeState: RoomRuntimeStateService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
  ) {}

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    await this.roomEvents.publishRoomStateUpdated(roomId);
  }

  isBanned(roomId: number, userId: number): boolean {
    return this.runtimeState.isBanned(roomId, userId);
  }

  ban(roomId: number, userId: number): void {
    this.runtimeState.ban(roomId, userId);
  }

  unban(roomId: number, userId: number): void {
    this.runtimeState.unban(roomId, userId);
  }

  async primeRoomPayloadCache(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    await this.payloads.prime(roomId, payload);
  }

  async invalidateRoomPayloadCache(roomId: number): Promise<void> {
    await this.payloads.invalidate(roomId);
  }

  async updateRoomPayloadCache(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    return this.payloads.update(roomId, updater);
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    return this.payloads.getRoomPayload(roomId);
  }
}
/** Room application capability boundary. */
