import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { queueConfiguredPawnSelection } from '../../../../../pawn-selection/public-api';
import { loadCanonicalPawns } from '../../../../../pawn-selection/public-api';
import { loadV1Content } from '../../../../../core/application/helpers/content-loader.helper';
import type {
  FrousseBoardJsonV1,
  FrousseCardsJsonV1,
  FrousseMetadata,
  FroussePawnsJsonV1,
} from '../../model/frousse.types';

export class FrousseSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const pawns = this.loadPawns();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const seedMeta = asRecord(base.metadata);
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: FrousseMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses: {
        skipTurn: {},
        ignoreNextTrap: {},
        ignoreTrapUntilNextDraw: {},
        ignoreNextPrank: {},
        ignoreNextGhost: {},
        nextMoveCap: {},
        nextRollMalus: {},
        nextRollKeepLowest: {},
        nextRollDouble: {},
        nextRollIfThreeBackTwo: {},
        blocked: {},
      },
      decks: { cards: shuffled.values, discard: [] },
      pawns: loadCanonicalPawns(
        Array.isArray(pawns.pawns) ? pawns.pawns : [],
      ).map((pawn) => ({
        id: pawn.id,
        name: pawn.name,
        description: pawn.description,
      })),
      pendingContext: null,
      winnerId: null,
    };

    const baseMetadata = (base.metadata ?? {}) as Record<string, unknown>;
    const initial: GameStateEntity = {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: {
        ...baseMetadata,
        ...shuffled.meta,
        ...meta,
      },
    };

    return queueConfiguredPawnSelection({
      state: initial,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: (Array.isArray(meta.pawns) ? meta.pawns : [])
        .map((p) => ({
          id: toText(p?.id),
          label: toText(p?.name) || toText(p?.id),
          description: toText(p?.description),
        }))
        .filter((p) => p.id.length > 0),
      startPlayerId: players[0]?.id ?? null,
      pendingType: 'choose_pawn',
      playerPawnField: 'pawn',
      pawnDataMapper: (choice) => ({
        id: toText(choice.id),
        label: toText(choice.label),
        description: toText(choice.description),
      }),
      extraPendingData: { kind: 'choose_pawn' },
    });
  }

  private loadBoard(): FrousseBoardJsonV1 {
    return loadV1Content<FrousseBoardJsonV1>(this.contentLoader, {
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): FrousseCardsJsonV1 {
    return loadV1Content<FrousseCardsJsonV1>(this.contentLoader, {
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'cards.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private loadPawns(): FroussePawnsJsonV1 {
    return loadV1Content<FroussePawnsJsonV1>(this.contentLoader, {
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'pawns.json',
      arrayField: 'pawns',
      minItems: 1,
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}






