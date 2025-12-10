import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameLogEntry, GameStateEntity, PlayerStateEntity } from '../entities/game-state.entity';

@Injectable()
export class GameCoreService {
  buildBaseState(payload: RoomPayload, gameType: string): GameStateEntity {
    const players = this.buildPlayers(payload);
    return {
      status: payload.room.status || 'setup',
      phase: 'playing',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players,
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1,
      },
      metadata: {
        gameType,
        generatedAt: new Date().toISOString(),
      },
      botThinking: false,
    };
  }

  cloneState(state: GameStateEntity): GameStateEntity {
    return {
      ...state,
      log: [...(state.log || [])],
      players: state.players ? [...state.players] : undefined,
      turn: state.turn ? { ...state.turn } : undefined,
      metadata: state.metadata ? { ...state.metadata } : undefined,
    };
  }

  appendLog(state: GameStateEntity, message: string): GameStateEntity {
    const entry: GameLogEntry = { message, timestamp: new Date().toISOString() };
    const next = this.cloneState(state);
    next.log.push(entry);
    return next;
  }

  private buildPlayers(payload: RoomPayload): PlayerStateEntity[] {
    const players: PlayerStateEntity[] = [];
    payload.room.players.forEach((p) =>
      players.push({
        id: p.id,
        username: p.username,
        isBot: false,
        basket: [],
        inventory: [],
        shoppingList: [],
      }),
    );
    payload.room.bots.forEach((b, idx) =>
      players.push({
        id: -(idx + 1),
        username: b.name,
        isBot: true,
        basket: [],
        inventory: [],
        shoppingList: [],
      }),
    );
    return players;
  }
}
