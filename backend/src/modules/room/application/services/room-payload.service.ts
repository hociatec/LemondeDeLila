import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ROOM_PAYLOAD_CACHE,
  type RoomPayloadCachePort,
} from '../ports/room-payload-cache.port';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import { RoomPayload } from '../models/room-payload.model';
import { RoomPayloadBuilderService } from './room-payload-builder.service';

@Injectable()
export class RoomPayloadService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    private readonly payloadBuilder: RoomPayloadBuilderService,
    @Inject(ROOM_PAYLOAD_CACHE)
    private readonly roomPayloadCache: RoomPayloadCachePort,
  ) {}

  async prime(roomId: number, payload: RoomPayload): Promise<void> {
    await this.roomPayloadCache.prime(roomId, payload);
  }

  async invalidate(roomId: number): Promise<void> {
    await this.roomPayloadCache.invalidate(roomId);
  }

  async update(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null> {
    return this.roomPayloadCache.update(roomId, updater);
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    const cached = await this.roomPayloadCache.get(roomId);
    if (cached) {
      return cached;
    }

    const room = await this.rooms.findByIdWithPayloadRelations(roomId);
    if (!room) {
      throw new NotFoundException('Room introuvable');
    }

    const payload = await this.payloadBuilder.build(room);
    await this.roomPayloadCache.persist(roomId, payload);
    return payload;
  }
}
