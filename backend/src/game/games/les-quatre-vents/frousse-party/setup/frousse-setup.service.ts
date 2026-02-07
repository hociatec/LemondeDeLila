import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  FrousseBoardJsonV1,
  FrousseCardsJsonV1,
  FrousseMetadata,
  FroussePawnsJsonV1,
} from '../model/frousse.types';
import { buildPawnSelectionPending } from '../pawn-selection';

@Injectable()
export class FrousseSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const pawns = this.loadPawns();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const seedMeta = (base.metadata ?? {}) as any;
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
      decks: { cards: shuffled.values as any, discard: [] },
      pawns: Array.isArray(pawns.pawns) ? pawns.pawns : [],
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

    const pending = buildPawnSelectionPending(players, meta);
    return pending ? { ...initial, pending } : initial;
  }

  private loadBoard(): FrousseBoardJsonV1 {
    return this.contentLoader.loadContent<FrousseBoardJsonV1>({
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(): FrousseCardsJsonV1 {
    return this.contentLoader.loadContent<FrousseCardsJsonV1>({
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'cards.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }

  private loadPawns(): FroussePawnsJsonV1 {
    return this.contentLoader.loadContent<FroussePawnsJsonV1>({
      gameType: 'frousse-party',
      baseDir: __dirname,
      filename: 'pawns.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('pawns', 1),
      ],
    });
  }
}
