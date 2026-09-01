import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GAME_ROOM_CONTEXT_PORT,
  type GameRoomContextPort,
  type GameRoomPayload,
} from '../../../application/ports/game-room.port';

@Injectable()
export class GameWsRoomContextService {
  constructor(
    @Inject(GAME_ROOM_CONTEXT_PORT)
    private readonly roomGame: GameRoomContextPort,
  ) {}

  async ensureReadable(roomId: number, userId: number): Promise<void> {
    const payload = await this.roomGame.getRoomPayload(roomId);
    const room = payload.room;
    if (!room.isPrivate) return;

    const isOwner = room.owner?.id === userId;
    const isParticipant = (room.players ?? []).some(
      (participant) => participant.id === userId,
    );
    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('Accès non autorisé');
    }
  }

  async ensureWritable(roomId: number, userId: number): Promise<void> {
    const room = (await this.roomGame.getRoomPayload(roomId)).room;
    const isOwner = room.owner?.id === userId;
    const isParticipant = (room.players ?? []).some(
      (participant) => participant.id === userId,
    );
    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('Action de jeu non autorisée');
    }
  }

  async transition(
    roomId: number,
    operation: 'reset' | 'start',
    userId: number,
    requestedGameType = '',
  ): Promise<string> {
    const room = (await this.roomGame.getRoomPayload(roomId)).room;
    const gameType = requestedGameType || String(room.gameType ?? '').trim();
    if (!gameType) throw new NotFoundException('Jeu introuvable');

    if (operation === 'reset') {
      await this.roomGame.resetRoom(roomId, userId);
    } else {
      await this.roomGame.startRoom(roomId, userId);
    }
    return gameType;
  }

  async buildPayload(roomId: number): Promise<GameRoomPayload> {
    return this.roomGame.getRoomPayload(roomId);
  }

  async prepareNextRun(roomId: number): Promise<void> {
    await this.roomGame.prepareNextRun(roomId);
  }
}
