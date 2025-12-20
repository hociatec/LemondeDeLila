import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameStateEntity } from '../../core/entities/game-state.entity';

@Injectable()
export class GameEngineStateStore {
  private readonly states = new Map<string, GameStateEntity>();

  buildKey(roomId: number, gameType: string): string {
    return `${gameType}:${roomId}`;
  }

  get(roomId: number, gameType: string): GameStateEntity | undefined {
    return this.states.get(this.buildKey(roomId, gameType));
  }

  set(roomId: number, gameType: string, state: GameStateEntity): void {
    this.states.set(this.buildKey(roomId, gameType), state);
  }

  delete(roomId: number, gameType: string): void {
    this.states.delete(this.buildKey(roomId, gameType));
  }

  markBotThinking(
    state: GameStateEntity,
    botThinking: boolean,
  ): GameStateEntity {
    return { ...state, botThinking };
  }

  syncRoomStatus(
    state: GameStateEntity,
    payload: RoomPayload,
  ): GameStateEntity {
    const payloadStatus = payload?.room?.status;
    if (!payloadStatus || payloadStatus === state.status) {
      return state;
    }
    if (
      (state.status || '').toLowerCase() === 'started' &&
      payloadStatus !== 'finished'
    ) {
      return state;
    }
    return { ...state, status: payloadStatus };
  }
}
