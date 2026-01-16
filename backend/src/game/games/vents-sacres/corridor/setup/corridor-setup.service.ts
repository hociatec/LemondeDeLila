import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { CORRIDOR_GAME } from '../definitions/game.definition';
import type { CorridorMetadata } from '../model/corridor.model';

@Injectable()
export class CorridorSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '').toLowerCase().trim();
    if (status !== 'started') {
      // En "setup" (table non démarrée), ne pas auto-démarrer une partie :
      // le moteur reconstruira l'état quand la room passera en "started".
      return {
        ...baseState,
        metadata: {
          ...(baseState.metadata ?? {}),
          size: CORRIDOR_GAME.boardSize,
          winnerPlayerId: null,
        } as any,
      };
    }

    const players = baseState.players ?? [];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new Error('Nombre de joueurs insuffisant pour dǸmarrer Le Corridor.');
    }

    const size = CORRIDOR_GAME.boardSize;
    const p1 = players[0];
    const p2 = players[1];
    const startX = Math.floor(size / 2);

    const metadata: CorridorMetadata = {
      size,
      pawnsByPlayerId: {
        [String(p1.id)]: { x: startX, y: 0 },
        [String(p2.id)]: { x: startX, y: size - 1 },
      },
      walls: { h: [], v: [] },
      wallsRemainingByPlayerId: {
        [String(p1.id)]: CORRIDOR_GAME.wallsPerPlayer,
        [String(p2.id)]: CORRIDOR_GAME.wallsPerPlayer,
      },
      winnerPlayerId: null,
    };

    return {
      ...baseState,
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      metadata: { ...(baseState.metadata ?? {}), ...(metadata as any) },
      pending: null,
      log: [...(baseState.log ?? []), { message: 'Le Corridor dǸmarre.' }],
      turn: {
        currentPlayerId: p1.id,
        direction: 1,
        label: `Tour de ${p1.username}`,
      },
    };
  }
}
