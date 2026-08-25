import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import { getSafePlayers } from '../../../../../core/application/helpers/setup-service.helper';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { queueConfiguredPawnSelection } from '../../../../../pawn-selection/public-api';
import { ensureSeededRng } from '../../../../../../common/utils/public-api';
import { seededShuffle } from '../../../../../../common/utils/public-api';
import type { JeuOieCaseTextsJsonV1 } from '../../model/jeu-oie-content.model';
import { loadV1Content } from '../../../../../core/application/helpers/content-loader.helper';
import type {
  JeuOieMetadata,
  JeuOiePawn,
  JeuOieTile,
} from '../../model/jeu-oie-state.model';

const JEU_OIE_PAWNS: JeuOiePawn[] = [
  { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
  { id: 'vache-artistique', label: 'Vache artistique', feminine: true },
  { id: 'cochon-gourmand', label: 'Cochon gourmand', feminine: false },
  { id: 'poule-scientifique', label: 'Poule scientifique', feminine: true },
  { id: 'chevre-acrobate', label: 'Chèvre acrobate', feminine: true },
  { id: 'marmotte-reveuse', label: 'Marmotte rêveuse', feminine: true },
];

export class JeuOieSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private loadTexts(): JeuOieCaseTextsJsonV1 {
    return loadV1Content<JeuOieCaseTextsJsonV1>(this.contentLoader, {
      gameType: 'jeu-oie',
      baseDir: __dirname,
      contentDir: '../../model/content',
      filename: 'descriptions.json',
      arrayField: 'cases',
      minItems: 1,
    });
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
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: starterId,
        direction: 1,
      },
      metadata: { ...(baseState.metadata ?? {}), ...meta },
    };

    return queueConfiguredPawnSelection({
      state: next,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: JEU_OIE_PAWNS.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        feminine: pawn.feminine,
      })),
      startPlayerId: starterId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'pawnByPlayerId',
      pawnDataMapper: (choice) => ({
        id: choice.id,
        label: choice.label,
        feminine: Boolean(choice?.feminine),
      }),
    });
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






