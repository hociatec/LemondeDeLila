import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
} from '../../../engine/sdk/public-api';
import { ZIG_ET_ZAG_DECK } from './content';
import {
  createRound,
  ZIG_ET_ZAG_ACTIONS,
  ZIG_ET_ZAG_PHASES,
  zigRoundPlays,
} from './rules';
import type { ZigEtZagRoundSummary, ZigEtZagState } from './state';

type ZigEtZagBattleLogEntry = {
  key: 'zig.battle.started' | 'zig.battle.continues';
  params: { roundNumber: number };
};

type ZigEtZagPlayerView = {
  lastRound:
    (ZigEtZagRoundSummary & { battleLog: ZigEtZagBattleLogEntry[] }) | null;
};

const INITIAL_HAND_SIZE = 27;
const cardSchema = defineCardsSchema({
  decks: {
    battle: cards.deck({
      id: 'battle',
      cards: ZIG_ET_ZAG_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'battle',
      initial: INITIAL_HAND_SIZE,
      visibility: 'owner',
    }),
  },
});

export default defineGame<ZigEtZagState>()({
  id: 'zig-et-zag',
  displayName: 'Zig et Zag !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Une bataille à familles, figures et jokers colorés.',
  players: { min: 2, max: 2 },
  content: defineGameContent('zig-et-zag', { cards: ZIG_ET_ZAG_DECK }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'battle',
      handId: 'players',
    }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw_card' }],
  initialization: { firstPlayer: 'first', startRound: true },
  setup: ({ ctx }) => {
    const round = createRound(ctx);
    return {
      battle: round,
      lastRound: null,
    };
  },
  initialPhase: ZIG_ET_ZAG_PHASES.initialPhase,
  phases: ZIG_ET_ZAG_PHASES.phases,
  actions: ZIG_ET_ZAG_ACTIONS,
  viewExtension: ({ state, ctx }): ZigEtZagPlayerView => {
    const summary = state.lastRound;
    const lastRound = summary
      ? {
          roundNumber: summary.roundNumber,
          roundWinnerPlayerId: summary.roundWinnerPlayerId,
          cardsWon: summary.cardsWon,
          plays: zigRoundPlays({
            plays: summary.plays,
            tiedPlayers: [],
          }),
          battleLog: ctx.events
            .messages()
            .flatMap((entry): ZigEtZagBattleLogEntry[] => {
              if (
                (entry.key !== 'zig.battle.started' &&
                  entry.key !== 'zig.battle.continues') ||
                entry.params.roundNumber !== summary.roundNumber
              ) {
                return [];
              }
              return [
                {
                  key: entry.key,
                  params: { roundNumber: summary.roundNumber },
                },
              ];
            }),
        }
      : null;
    return { lastRound };
  },
  bot: { choose: () => ({ type: 'draw_card', payload: {} }) },
});
