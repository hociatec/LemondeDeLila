import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RoomPayload } from '../../../../room/application/models/room-payload.model';
import {
  ROOM_GAME_PORT,
  type RoomGamePort,
} from '../../../../room/public-api';
import { Room } from '../../../../room/infrastructure/persistence/typeorm/entities/room.entity';

@Injectable()
export class GameWsRoomContextService {
  constructor(
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @Inject(ROOM_GAME_PORT)
    private readonly roomGame: RoomGamePort,
  ) {}

  async ensureReadable(roomId: number, userId: number): Promise<void> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: { participants: { user: true }, owner: true },
    });
    if (!room) throw new NotFoundException('Table introuvable');
    if (!room.isPrivate) return;

    const isOwner = room.owner?.id === userId;
    const isParticipant = (room.participants ?? []).some(
      (participant) => !participant.leftAt && participant.user?.id === userId,
    );
    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('Accès non autorisé');
    }
  }

  async transition(
    roomId: number,
    operation: 'reset' | 'start',
    userId: number,
    requestedGameType = '',
  ): Promise<string> {
    const room = await this.findRoom(roomId);
    const gameType = requestedGameType || String(room.gameType ?? '').trim();
    if (!gameType) throw new NotFoundException('Jeu introuvable');

    if (operation === 'reset') {
      await this.roomGame.resetRoom(roomId, userId);
    } else {
      await this.roomGame.startRoom(roomId, userId);
    }
    return gameType;
  }

  async buildPayload(roomId: number): Promise<RoomPayload> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: { participants: { user: true }, bots: true, owner: true },
    });
    if (!room) throw new NotFoundException('Table introuvable');

    const players = (room.participants ?? [])
      .filter((participant) => !participant.leftAt)
      .map((participant) => ({
        id: participant.user.id,
        username: participant.user.username,
      }));
    const bots = (room.bots ?? []).map((bot) => ({
      id: bot.id,
      name: bot.name,
    }));
    return {
      manifest: null,
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: room.gameType,
        startedAt: room.startedAt ? room.startedAt.toISOString() : null,
        runId: room.runId,
        tableAmbienceSoundId: room.tableAmbienceSoundId,
        counts: { players: players.length, spectators: 0 },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players,
        spectators: [],
        bots,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async findRoom(roomId: number): Promise<Room> {
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Table introuvable');
    return room;
  }
}
