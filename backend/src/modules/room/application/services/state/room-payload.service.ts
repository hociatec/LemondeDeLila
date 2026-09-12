import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ROOM_PAYLOAD_CACHE,
  type RoomPayloadCachePort,
} from '../../ports/room-payload-cache.port';
import {
  ROOM_PAYLOAD_READER,
  type RoomPayloadReader,
} from '../../ports/room-payload.reader';
import { RoomPayload } from '../../models/room-payload.model';
import { RoomPayloadBuilderService } from './room-payload-builder.service';

@Injectable()
export class RoomPayloadService {
  constructor(
    @Inject(ROOM_PAYLOAD_READER)
    private readonly rooms: RoomPayloadReader,
    private readonly payloadBuilder: RoomPayloadBuilderService,
    @Inject(ROOM_PAYLOAD_CACHE)
    private readonly roomPayloadCache: RoomPayloadCachePort,
  ) {}

  async prime(roomId: number, payload: RoomPayload): Promise<void> {
    await this.bestEffortCache(() =>
      this.roomPayloadCache.prime(roomId, payload),
    );
  }

  async invalidate(roomId: number): Promise<void> {
    await this.bestEffortCache(() => this.roomPayloadCache.invalidate(roomId));
  }

  async update(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    try {
      return await this.roomPayloadCache.update(roomId, updater);
    } catch {
      return null;
    }
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    return this.refreshRoomPayload(roomId);
  }

  async refreshRoomPayload(roomId: number): Promise<RoomPayload> {
    const room = await this.rooms.findPayload(roomId);
    if (!room) {
      throw new NotFoundException('Room introuvable');
    }

    const payload = await this.payloadBuilder.build(room);
    await this.bestEffortCache(() =>
      this.roomPayloadCache.persist(roomId, payload),
    );
    return payload;
  }

  private async bestEffortCache(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch {
      // The database payload remains authoritative when the cache is unavailable.
    }
  }
}
/** Room application capability boundary. */
