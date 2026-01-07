import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { OdysseeMetadata, OdysseePawnState } from '../model/odyssee.types';

@Injectable()
export class OdysseeSetupService {
  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const players = Array.isArray(base.players) ? base.players : [];
    const trackLength = 56;
    const homeLength = 6;

    const offsets: Record<number, number> = {};
    players.forEach((p, i) => {
      offsets[p.id] = (i * 14) % trackLength;
    });

    const pawnsByPlayer: Record<number, OdysseePawnState[]> = {};
    for (const p of players) {
      pawnsByPlayer[p.id] = [0, 1, 2, 3].map((pawnIndex) => ({
        pawnIndex,
        progress: -1,
      }));
    }

    const meta: OdysseeMetadata = {
      trackLength,
      homeLength,
      offsets,
      safeTiles: [],
      pawnsByPlayer,
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: { ...(base.metadata ?? {}), ...meta },
    };
  }
}
