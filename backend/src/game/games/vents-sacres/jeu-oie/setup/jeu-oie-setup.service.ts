import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import type { JeuOieCaseTextsJsonV1 } from '../model/jeu-oie-content.entity';
import type { JeuOieMetadata, JeuOieTile } from '../model/jeu-oie-state.entity';

@Injectable()
export class JeuOieSetupService {
  constructor(private readonly contentLoader: GameContentLoaderService) {}

  private loadTexts(): JeuOieCaseTextsJsonV1 {
    return this.contentLoader.loadContent<JeuOieCaseTextsJsonV1>({
      gameType: 'jeu-oie',
      baseDir: __dirname,
      filename: 'descriptions.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cases', 1),
      ],
    });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 1;
      laps[p.id] = 0;
    }

    const meta: JeuOieMetadata = {
      tiles: buildTiles(this.loadTexts()),
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

function buildTiles(texts: JeuOieCaseTextsJsonV1): JeuOieTile[] {
  const byIndex = new Map<number, { title: string; description: string }>();
  for (const c of texts?.cases ?? []) {
    const index = typeof c?.index === 'number' ? c.index : Number(c?.index);
    if (!Number.isFinite(index)) continue;
    const title = typeof c?.title === 'string' ? c.title.trim() : '';
    const description =
      typeof c?.description === 'string' ? c.description.trim() : '';
    if (!title && !description) continue;
    byIndex.set(Math.trunc(index), { title, description });
  }

  const tiles: JeuOieTile[] = [];
  const goose = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);

  // 0..63 inclus (64 cases). Victoire = case 63.
  for (let i = 0; i <= 63; i += 1) {
    if (i === 0) {
      tiles.push({
        id: 'outside',
        type: 'normal',
        label: 'Case 0 - Hors plateau',
      });
      continue;
    }
    if (i === 1) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'start',
        type: 'start',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Départ`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 63) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'finish',
        type: 'finish',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Arrivée`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 6) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'bridge',
        type: 'bridge',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Pont`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 19) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'inn',
        type: 'inn',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Auberge`,
        description: t?.description || undefined,
        skipTurns: 1,
      });
      continue;
    }
    if (i === 42) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'labyrinth',
        type: 'labyrinth',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Labyrinthe`,
        description: t?.description || undefined,
        backTo: 30,
      });
      continue;
    }
    if (i === 52) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'prison',
        type: 'prison',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Prison`,
        description: t?.description || undefined,
        skipTurns: 2,
      });
      continue;
    }
    if (i === 58) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'death',
        type: 'death',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Mort`,
        description: t?.description || undefined,
        backTo: 1,
      });
      continue;
    }
    if (goose.has(i)) {
      const t = byIndex.get(i);
      tiles.push({
        id: `goose-${i}`,
        type: 'goose',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Oie`,
        description: t?.description || undefined,
      });
      continue;
    }
    const t = byIndex.get(i);
    tiles.push({
      id: `c${i}`,
      type: 'normal',
      label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i}`,
      description: t?.description || undefined,
    });
  }
  return tiles;
}
