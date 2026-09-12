import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  GAME_ROOM_CONTEXT_PORT,
  type GameRoomContextPort,
  type GameRoomPayload,
} from '../../../application/ports/game-room.port';
import {
  asRoomId,
  asUserId,
} from '../../../../../shared/interfaces/public-api';

@Injectable()
export class GameWsRoomContextService {
  constructor(
    @Inject(GAME_ROOM_CONTEXT_PORT)
    private readonly roomGame: GameRoomContextPort,
  ) {}

  ensureReadable(roomId: number, userId: number): Promise<void> {
    return this.roomGame.authorizeGameAccess(
      asRoomId(roomId),
      asUserId(userId),
      'read',
    );
  }

  ensureWritable(roomId: number, userId: number): Promise<void> {
    return this.roomGame.authorizeGameAccess(
      asRoomId(roomId),
      asUserId(userId),
      'write',
    );
  }

  async transition(
    roomId: number,
    operation: 'reset' | 'start',
    userId: number,
    requestedGameType = '',
  ): Promise<string> {
    const typedRoomId = asRoomId(roomId);
    const typedUserId = asUserId(userId);
    const room = (await this.roomGame.getRoomPayload(typedRoomId)).room;
    const gameType = requestedGameType || String(room.gameType ?? '').trim();
    if (!gameType) throw new NotFoundException('Jeu introuvable');

    if (operation === 'reset') {
      await this.roomGame.resetRoom(typedRoomId, typedUserId);
    } else {
      await this.roomGame.startRoom(typedRoomId, typedUserId);
    }
    return gameType;
  }

  async buildPayload(roomId: number): Promise<GameRoomPayload> {
    return this.roomGame.getRoomPayload(asRoomId(roomId));
  }

  async refreshPayload(roomId: number): Promise<GameRoomPayload> {
    return this.roomGame.refreshRoomPayload(asRoomId(roomId));
  }

  async prepareNextRun(roomId: number): Promise<void> {
    await this.roomGame.prepareNextRun(asRoomId(roomId));
  }
}
