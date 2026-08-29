import { Injectable } from '@nestjs/common';
import type { RoomEventPublisherPort } from '../../application/ports/room-event-publisher.port';
import { RoomEventsBusService } from './room-events-bus.service';

@Injectable()
export class RoomEventPublisherAdapter implements RoomEventPublisherPort {
  constructor(private readonly eventsBus: RoomEventsBusService) {}

  async publishRoomStateUpdated(roomId: number): Promise<void> {
    await this.eventsBus.publishRoomStateUpdated(roomId);
  }

  async publishRoomDeleted(roomId: number): Promise<void> {
    await this.eventsBus.publishRoomDeleted(roomId);
  }

  async publishLobbyChanged(roomId: number, reason: string): Promise<void> {
    await this.eventsBus.publishLobbyChanged(roomId, reason);
  }
}
