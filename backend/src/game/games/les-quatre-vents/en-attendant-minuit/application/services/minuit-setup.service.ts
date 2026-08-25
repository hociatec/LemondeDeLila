import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { GameContentLoaderService } from '../../../../../engine/public-api';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { loadV1Content } from '../../../../../core/application/helpers/content-loader.helper';
import { loadCanonicalPawns } from '../../../../../pawn-selection/public-api';
import { queueConfiguredPawnSelection } from '../../../../../pawn-selection/public-api';
import type {
  MinuitBoardJsonV1,
  MinuitCardsJsonV1,
  MinuitMetadata,
  MinuitPawn,
  MinuitPawnsJsonV1,
} from '../../model/minuit.types';

const DEFAULT_PAWNS = [
  'Le Lutin',
  'Le Bonhomme de Neige',
  'La Fée des Flocons',
  'Le Père Noël',
  'Le Renne',
  "Le Petit Bonhomme en Pain d'Épices",
];

export class MinuitSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private isBotLike(player: unknown): boolean {
    const playerRecord = asRecord(player);
    if (playerRecord.isBot === true) return true;
    const id = Number(playerRecord.id);
    if (Number.isFinite(id) && id < 0) return true;
    const username =
      typeof playerRecord.username === 'string'
        ? playerRecord.username.toLowerCase()
        : '';
    return username.includes('bot');
  }

  private hasPawnAssigned(player: unknown, meta: MinuitMetadata): boolean {
    const playerRecord = asRecord(player);
    const playerId = Number(playerRecord.id);
    if (!Number.isFinite(playerId)) return false;
    const playerPawn =
      typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
    if (playerPawn.length > 0) return true;
    const metaPawn = String((meta.pawns ?? {})[playerId] ?? '').trim();
    return metaPawn.length > 0;
  }

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const pawns = this.loadPawns();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;
    const botPlayerIds = Array.from(
      new Set(
        players
          .filter((p) => this.isBotLike(p))
          .map((p) => Number(p?.id))
          .filter((id) => Number.isFinite(id)),
      ),
    );

    const seedMeta = (base.metadata ?? {}) as MinuitMetadata;
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: MinuitMetadata = {
      tiles: board.tiles ?? [],
      positions,
      botPlayerIds,
      starterPlayerId:
        typeof base.turn?.currentPlayerId === 'number'
          ? base.turn.currentPlayerId
          : null,
      starterTurnIndex:
        typeof base.turnIndex === 'number' ? base.turnIndex : null,
      starterRestoredAfterPawnSelection: false,
      pawnChoices: loadCanonicalPawns(
        Array.isArray(pawns.pawns) ? pawns.pawns : [],
      ).map((pawn) => ({
        id: pawn.id,
        name: pawn.name,
        description: pawn.description,
      })),
      statuses: {
        skipTurn: {},
        ignoreNextMalus: {},
        ignoreNextSkip: {},
        forceDrawNextTurn: {},
        keepTurn: {},
      },
      decks: { cards: shuffled.values, discard: [] },
      pendingQuiz: null,
      pendingContext: null,
      winnerId: null,
    };

    const playersForPending = Array.isArray(base.players) ? base.players : [];
    const missingForPending = playersForPending.filter(
      (p) => !!p && !this.isBotLike(p) && !this.hasPawnAssigned(p, meta),
    );
    const next: GameStateEntity = {
      ...base,
      phase: 'playing',
      turn:
        !missingForPending.length || playersForPending[0]?.id == null
          ? base.turn
          : {
              ...(base.turn ?? { direction: 1 }),
              currentPlayerId: playersForPending[0]?.id ?? null,
              direction: 1,
            },
      metadata: {
        ...(base.metadata ?? {}),
        ...shuffled.meta,
        ...meta,
      },
    };

    if (!missingForPending.length) {
      return next;
    }

    return queueConfiguredPawnSelection({
      state: next,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: this.listPawnChoiceEntries(meta, pawns.pawns ?? []),
      startPlayerId: playersForPending[0]?.id ?? null,
      pendingType: 'pick_pawn',
      playerPawnField: 'pawn',
      isBotPlayer: (player) => this.isBotLike(player),
      includeChoiceMapData: true,
      pawnDataMapper: (choice: unknown) => {
        const choiceRecord = asRecord(choice);
        return {
          id: toText(choiceRecord.id).trim(),
          label: toText(choiceRecord.label).trim(),
          description: toText(choiceRecord.description).trim(),
        };
      },
    });
  }

  private listPawnChoiceEntries(
    meta: MinuitMetadata,
    pawns: MinuitPawn[],
  ): Array<{ id: string; label: string; description: string }> {
    const fromContent = Array.isArray(meta.pawnChoices)
      ? meta.pawnChoices
      : Array.isArray(pawns)
        ? pawns
        : [];

    if (fromContent.length) {
      return fromContent
        .map((pawn) => {
          const pawnRecord = asRecord(pawn);
          const id = toText(pawnRecord.id).trim();
          const name = toText(pawnRecord.name).trim();
          if (!id || !name) return null;
          const description = toText(pawnRecord.description).trim();
          const label = description ? `${name}: ${description}` : name;
          return { id, label, description };
        })
        .filter(Boolean) as Array<{
        id: string;
        label: string;
        description: string;
      }>;
    }

    return DEFAULT_PAWNS.map((name) => ({
      id: name,
      label: name,
      description: '',
    }));
  }

  private loadBoard(): MinuitBoardJsonV1 {
    return loadV1Content<MinuitBoardJsonV1>(this.contentLoader, {
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      contentDir: '../../model/content',
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCards(): MinuitCardsJsonV1 {
    return loadV1Content<MinuitCardsJsonV1>(this.contentLoader, {
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      contentDir: '../../model/content',
      filename: 'cards.json',
      arrayField: 'cards',
      minItems: 1,
    });
  }

  private loadPawns(): MinuitPawnsJsonV1 {
    return loadV1Content<MinuitPawnsJsonV1>(this.contentLoader, {
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      contentDir: '../../model/content',
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
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}






