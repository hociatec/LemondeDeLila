import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import type {
  MinuitBoardJsonV1,
  MinuitCardsJsonV1,
  MinuitMetadata,
  MinuitPawn,
  MinuitPawnsJsonV1,
} from '../model/minuit.types';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

const DEFAULT_PAWNS = [
  'Le Lutin',
  'Le Bonhomme de Neige',
  'La FÃ©e des Flocons',
  'Le PÃ¨re NoÃ«l',
  'Le Renne',
  "Le Petit Bonhomme en Pain d'Ã‰pices",
];

@Injectable()
export class MinuitSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const id = Number(player.id);
    if (Number.isFinite(id) && id < 0) return true;
    const username = String(player?.username ?? '').toLowerCase();
    return username.includes('bot');
  }

  private hasPawnAssigned(player: any, meta: MinuitMetadata): boolean {
    if (!player) return false;
    const playerId = Number(player.id);
    if (!Number.isFinite(playerId)) return false;
    const playerPawn = String(player.pawn ?? '').trim();
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
          .map((p) => Number((p as any)?.id))
          .filter((id) => Number.isFinite(id)),
      ),
    );

    const seedMeta = (base.metadata ?? {}) as any;
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
      pawnChoices: Array.isArray(pawns.pawns) ? pawns.pawns : [],
      statuses: {
        skipTurn: {},
        ignoreNextMalus: {},
        ignoreNextSkip: {},
        forceDrawNextTurn: {},
        keepTurn: {},
      },
      decks: { cards: shuffled.values as any, discard: [] },
      pendingQuiz: null,
      pendingContext: null,
      winnerId: null,
    };

    const playersForPending = Array.isArray(base.players) ? base.players : [];
    const missingForPending = playersForPending.filter(
      (p) => !!p && !this.isBotLike(p) && !this.hasPawnAssigned(p, meta),
    );
    const pending = !missingForPending.length
      ? null
      : (this.setupFlow.createSequentialPawnPending({
          players: playersForPending,
          startPlayerId: playersForPending[0]?.id ?? null,
          isAssigned: (playerId) => {
            const player = playersForPending.find((p) => p?.id === playerId);
            return !player || this.isBotLike(player) || this.hasPawnAssigned(player, meta);
          },
          pendingType: 'pick_pawn',
          pawns: (() => {
            const taken = new Set<string>(
              playersForPending
                .map((p) => (typeof p?.pawn === 'string' ? String(p.pawn).trim() : ''))
                .filter((pawn) => pawn.length > 0),
            );
            const entries = this.listPawnChoiceEntries(meta, pawns.pawns ?? []);
            const available = entries.filter((entry) => !taken.has(entry.title));
            const chosenEntries = available.length ? available : [...entries];
            return chosenEntries.map((entry) => ({ id: entry.title, label: entry.label, title: entry.title }));
          })(),
          includeChoiceMapData: true,
          pawnDataMapper: (choice: any) => ({
            id: String(choice?.id ?? '').trim(),
            label: String(choice?.label ?? '').trim(),
            title: String(choice?.title ?? choice?.id ?? '').trim(),
          }),
        })?.pending as any);

    let next: GameStateEntity = {
      ...base,
      phase: 'playing',
      pending,
      turn: pending?.playerId
        ? {
            ...(base.turn ?? { direction: 1 }),
            currentPlayerId: pending.playerId,
            direction: 1,
          }
        : base.turn,
      metadata: {
        ...(base.metadata ?? {}),
        ...shuffled.meta,
        ...meta,
      },
    };

    return next;
  }

  private listPawnChoiceEntries(
    meta: MinuitMetadata,
    pawns: MinuitPawn[],
  ): Array<{ title: string; label: string }> {
    const fromContent = Array.isArray(meta.pawnChoices)
      ? meta.pawnChoices
      : Array.isArray(pawns)
        ? pawns
        : [];

    if (fromContent.length) {
      return fromContent
        .map((pawn) => {
          const title = String(pawn?.title ?? '').trim();
          if (!title) return null;
          const description = String(pawn?.description ?? '').trim();
          const label = description ? `${title}: ${description}` : title;
          return { title, label };
        })
        .filter(Boolean) as Array<{ title: string; label: string }>;
    }

    return DEFAULT_PAWNS.map((title) => ({ title, label: title }));
  }

  private loadBoard(): MinuitBoardJsonV1 {
    return loadV1Content<MinuitBoardJsonV1>(this.contentLoader, { gameType: 'en-attendant-minuit', baseDir: __dirname, filename: 'board.json', arrayField: 'tiles', minItems: 1 });
  }

  private loadCards(): MinuitCardsJsonV1 {
    return loadV1Content<MinuitCardsJsonV1>(this.contentLoader, { gameType: 'en-attendant-minuit', baseDir: __dirname, filename: 'cards.json', arrayField: 'cards', minItems: 1 });
  }

  private loadPawns(): MinuitPawnsJsonV1 {
    return loadV1Content<MinuitPawnsJsonV1>(this.contentLoader, { gameType: 'en-attendant-minuit', baseDir: __dirname, filename: 'pawns.json', arrayField: 'pawns', minItems: 1 });
  }
}








