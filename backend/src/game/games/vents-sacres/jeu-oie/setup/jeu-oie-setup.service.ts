import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getRngMeta, getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { ensureSeededRng } from '../../../../../common/utils/seeded-rng';
import { seededShuffle } from '../../../../../common/utils/seeded-shuffle';
import type { JeuOieCaseTextsJsonV1 } from '../model/jeu-oie-content.entity';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  JeuOieMetadata,
  JeuOiePawn,
  JeuOieTile,
} from '../model/jeu-oie-state.entity';

const JEU_OIE_PAWNS: JeuOiePawn[] = [
  { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
  { id: 'vache-artistique', label: 'Vache artistique', feminine: true },
  { id: 'cochon-gourmand', label: 'Cochon gourmand', feminine: false },
  { id: 'poule-scientifique', label: 'Poule scientifique', feminine: true },
  { id: 'chevre-acrobate', label: 'Chèvre acrobate', feminine: true },
  { id: 'marmotte-reveuse', label: 'Marmotte rêveuse', feminine: true },
];

@Injectable()
export class JeuOieSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private loadTexts(): JeuOieCaseTextsJsonV1 {
    return loadV1Content<JeuOieCaseTextsJsonV1>(this.contentLoader, { gameType: 'jeu-oie', baseDir: __dirname, filename: 'descriptions.json', arrayField: 'cases', minItems: 1 });
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    const laps: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 1;
      laps[p.id] = 0;
    }
    const pawnByPlayerId: Record<number, string> = {};

    const starterId = resolveSeededStarterId(
      players,
      baseState.metadata ?? {},
      typeof baseState.turn?.currentPlayerId === 'number'
        ? baseState.turn.currentPlayerId
        : null,
    );
    const pendingInfo = this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: starterId,
      isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
      pendingType: 'choose_pawn',
      choices: JEU_OIE_PAWNS.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        feminine: pawn.feminine,
      })),
      labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir son pion.`,
      dataBuilder: (choices) => ({
        pawns: choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          feminine: Boolean((choice as any)?.feminine),
        })),
      }),
    });

    const meta: JeuOieMetadata = {
      tiles: buildTiles(this.loadTexts()),
      positions,
      laps,
      pawns: [...JEU_OIE_PAWNS],
      pawnByPlayerId,
      setupStarterId: starterId,
      statuses: { skipTurn: {}, well: {} },
      winnerId: null,
    };

    const next: GameStateEntity = {
      ...baseState,
      phase: 'turn',
      lastRoll: null,
      pending: pendingInfo?.pending ?? null,
      turnIndex:
        pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo?.playerId ?? starterId,
        direction: 1,
      },
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };

    if (!pendingInfo) return next;
    const chooser = players.find((p) => p?.id === pendingInfo.playerId);
    const chooserName = String((chooser as any)?.username ?? '').trim();
    const chooserLabel =
      chooserName.length > 0 ? chooserName : `Joueur ${pendingInfo.playerId}`;
    return this.core.appendLog(next, `${chooserLabel} doit choisir un pion.`);
  }
}

function resolveSeededStarterId(
  players: Array<{ id: number }>,
  meta: unknown,
  fallbackId: number | null,
): number | null {
  if (!players.length) return fallbackId;
  const seed = ensureSeededRng((meta ?? {}) as Record<string, unknown>).seed;
  const shuffled = seededShuffle(players, seed, 'jeu-oie:setup-starter');
  return shuffled[0]?.id ?? players[0]?.id ?? fallbackId;
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
    if (i === 26) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'magic-die',
        type: 'magic_die',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Dé magique`,
        description: t?.description || undefined,
      });
      continue;
    }
    if (i === 31) {
      const t = byIndex.get(i);
      tiles.push({
        id: 'well',
        type: 'well',
        label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Puits`,
        description: t?.description || undefined,
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

