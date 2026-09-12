import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../ports/room.repository';
import { buildUniqueActiveRoomPlayers } from './room-participant-roster';

@Injectable()
export class RoomGameAccessService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: Pick<
      RoomRepository,
      'findByIdWithPayloadRelations'
    >,
  ) {}

  async authorize(
    roomId: number,
    userId: number,
    mode: 'read' | 'write',
  ): Promise<void> {
    if (![roomId, userId].every((id) => Number.isSafeInteger(id) && id > 0))
      throw new BadRequestException('Invalid room or user identifier');
    // Authorization deliberately reads persistence, without consulting or filling a cache.
    const room = await this.rooms.findByIdWithPayloadRelations(roomId);
    if (!room) throw new NotFoundException('Room introuvable');
    if (mode === 'read' && !room.isPrivate) return;
    if (room.owner?.id === userId) return;
    if (
      buildUniqueActiveRoomPlayers(room.participants).some(
        (player) => player.id === userId,
      )
    )
      return;
    throw new ForbiddenException('Accès au jeu non autorisé');
  }
}
