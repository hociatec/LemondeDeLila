import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  MinuitBoardJsonV1,
  MinuitCardsJsonV1,
  MinuitMetadata,
  MinuitPawn,
  MinuitPawnsJsonV1,
} from '../model/minuit.types';

const DEFAULT_PAWNS = [
  'Le Lutin',
  'Le Bonhomme de Neige',
  'La Fée des Flocons',
  'Le Père Noël',
  'Le Renne',
  "Le Petit Bonhomme en Pain d'Épices",
];

@Injectable()
export class MinuitSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '').toLowerCase();
    return username.includes('bot');
  }

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const cards = this.loadCards();
    const pawns = this.loadPawns();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const seedMeta = (base.metadata ?? {}) as any;
    const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);

    const meta: MinuitMetadata = {
      tiles: board.tiles ?? [],
      positions,
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

    const pending = this.buildPawnPending(base, meta, pawns.pawns ?? []);

    return {
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
  }

  private buildPawnPending(
    base: GameStateEntity,
    meta: MinuitMetadata,
    pawns: MinuitPawn[],
  ): GameStateEntity['pending'] {
    const players = Array.isArray(base.players) ? base.players : [];
    const missing = players.filter(
      (p) => !!p && !this.isBotLike(p) && !String(p.pawn ?? '').trim(),
    );
    if (!missing.length) return null;

    const taken = new Set<string>(
      players
        .map((p) => (typeof p?.pawn === 'string' ? String(p.pawn).trim() : ''))
        .filter((pawn) => pawn.length > 0),
    );

    const choiceEntries = this.listPawnChoiceEntries(meta, pawns);
    const available = choiceEntries.filter((entry) => !taken.has(entry.title));
    const entries = available.length ? available : [...choiceEntries];
    const choices = entries.map((entry) => entry.label);
    const choiceMap = Object.fromEntries(entries.map((e) => [e.label, e.title]));
    const chooser = missing[0];

    return {
      type: 'pick_pawn',
      playerId: chooser.id,
      blocking: true,
      label: 'Choisissez votre pion, puis Entrée.',
      choices,
      data: { choices, choiceMap },
    } as any;
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
          const label = description ? `${title} — ${description}` : title;
          return { title, label };
        })
        .filter(Boolean) as Array<{ title: string; label: string }>;
    }

    return DEFAULT_PAWNS.map((title) => ({ title, label: title }));
  }

  private loadBoard(): MinuitBoardJsonV1 {
    return this.contentLoader.loadContent<MinuitBoardJsonV1>({
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCards(): MinuitCardsJsonV1 {
    return this.contentLoader.loadContent<MinuitCardsJsonV1>({
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      filename: 'cards.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }

  private loadPawns(): MinuitPawnsJsonV1 {
    return this.contentLoader.loadContent<MinuitPawnsJsonV1>({
      gameType: 'en-attendant-minuit',
      baseDir: __dirname,
      filename: 'pawns.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('pawns', 1),
      ],
    });
  }
}
