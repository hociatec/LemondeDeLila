import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  FrousseBoardJsonV1,
  FrousseCardsJsonV1,
  FrousseMetadata,
  FroussePawnsJsonV1,
} from '../model/frousse.types';

@Injectable()
export class FrousseSetupService {
  constructor(
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

    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players,
      startPlayerId: players[0]?.id ?? null,
      isAssigned: (playerId) => {
        const player = players.find((p: any) => p?.id === playerId);
        return String(player?.pawn ?? '').trim().length > 0;
      },
      pawns: (Array.isArray(meta.pawns) ? meta.pawns : [])
        .map((p) => ({
          id: String(p?.id ?? '').trim(),
          label: String(p?.title ?? p?.id ?? '').trim(),
          title: String(p?.title ?? p?.id ?? '').trim(),
          description: String((p as any)?.description ?? '').trim(),
        }))
        .filter((p) => p.id.length > 0),
      pawnDataMapper: (choice: any) => ({
          id: String(choice?.id ?? '').trim(),
          title: String(choice?.title ?? choice?.label ?? '').trim(),
          description: String(choice?.description ?? '').trim(),
      }),
      extraPendingData: { kind: 'choose_pawn' },
    });
    if (!pendingInfo) return initial;
    return {
      ...initial,
      pending: pendingInfo.pending,
      turnIndex: pendingInfo.turnIndex,
      turn: {
        ...(base.turn ?? { currentPlayerId: pendingInfo.playerId, direction: 1 }),
        currentPlayerId: pendingInfo.playerId,
        direction: base.turn?.direction === -1 ? -1 : 1,
      },
    };
  }

  private loadBoard(): FrousseBoardJsonV1 {
    return loadV1Content<FrousseBoardJsonV1>(this.contentLoader, { gameType: 'frousse-party', baseDir: __dirname, filename: 'board.json', arrayField: 'tiles', minItems: 1 });
  }

  private loadCards(): FrousseCardsJsonV1 {
    return loadV1Content<FrousseCardsJsonV1>(this.contentLoader, { gameType: 'frousse-party', baseDir: __dirname, filename: 'cards.json', arrayField: 'cards', minItems: 1 });
  }

  private loadPawns(): FroussePawnsJsonV1 {
    return loadV1Content<FroussePawnsJsonV1>(this.contentLoader, { gameType: 'frousse-party', baseDir: __dirname, filename: 'pawns.json', arrayField: 'pawns', minItems: 1 });
  }
}


