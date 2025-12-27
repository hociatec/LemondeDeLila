import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { JeuOieMetadata, JeuOieTile } from '../model/jeu-oie-state.entity';

@Injectable()
export class JeuOieSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
      laps[p.id] = 0;
    }

    const meta: JeuOieMetadata = {
      tiles: buildTiles(),
      positions,
      laps,
      statuses: { skipTurn: {} },
      winnerId: null,
    };

    return {
      ...baseState,
      phase: 'turn',
      lastRoll: null,
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };
  }
}

function buildTiles(): JeuOieTile[] {
  const tiles: JeuOieTile[] = [];
  const goose = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);

  // 0..63 inclus (64 cases). Victoire = case 63.
  for (let i = 0; i <= 63; i += 1) {
    if (i === 0) {
      tiles.push({ id: 'start', type: 'start', label: 'Départ' });
      continue;
    }
    if (i === 63) {
      tiles.push({ id: 'finish', type: 'finish', label: 'Arrivée' });
      continue;
    }
    if (i === 6) {
      tiles.push({ id: 'bridge', type: 'bridge', label: 'Pont' });
      continue;
    }
    if (i === 19) {
      tiles.push({ id: 'inn', type: 'inn', label: 'Auberge', skipTurns: 1 });
      continue;
    }
    if (i === 42) {
      tiles.push({
        id: 'labyrinth',
        type: 'labyrinth',
        label: 'Labyrinthe',
        backTo: 30,
      });
      continue;
    }
    if (i === 52) {
      tiles.push({ id: 'prison', type: 'prison', label: 'Prison', skipTurns: 2 });
      continue;
    }
    if (i === 58) {
      tiles.push({ id: 'death', type: 'death', label: 'Mort', backTo: 0 });
      continue;
    }
    if (goose.has(i)) {
      tiles.push({ id: `goose-${i}`, type: 'goose', label: 'Oie' });
      continue;
    }
    tiles.push({ id: `c${i}`, type: 'normal', label: `Case ${i}` });
  }
  return tiles;
}

