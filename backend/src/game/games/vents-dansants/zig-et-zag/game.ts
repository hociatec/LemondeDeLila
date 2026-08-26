import {
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import { ZIG_ET_ZAG_CARD_BY_ID, ZIG_ET_ZAG_DECK } from './content';
import {
  createRound,
  ZIG_ET_ZAG_ACTIONS,
  ZIG_ET_ZAG_PHASES,
  zigRoundPlays,
  zigWaitingPlayers,
} from './rules';
import type {
  ZigEtZagBattleLogEntry,
  ZigEtZagPlayerView,
  ZigEtZagState,
} from './state';

const INITIAL_HAND_SIZE = 27;

export default defineGame<
  ZigEtZagState,
  typeof ZIG_ET_ZAG_ACTIONS,
  ZigEtZagPlayerView
>({
  id: 'zig-et-zag',
  displayName: 'Zig et Zag !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Une bataille à familles, figures et jokers colorés.',
  players: { min: 2, max: 2 },
  patterns: [
    cardGame({
      deckId: 'battle',
      handId: 'players',
      cards: ZIG_ET_ZAG_DECK.map((card) => card.id),
      initialHandSize: INITIAL_HAND_SIZE,
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
  view: ({ state, ctx }) => {
    const stage = ZIG_ET_ZAG_PHASES.current(ctx);
    const waitingPlayers = zigWaitingPlayers(state.battle, ctx);
    const summary = state.lastRound;
    const lastRound = summary
      ? {
          ...structuredClone(summary),
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
    return playerView({
      game: {
        initialDeckCounts: ctx.players.byId(() => INITIAL_HAND_SIZE),
        lastRound,
        stage,
        waitingPlayers,
      },
      extras: {
        cardCatalog: ZIG_ET_ZAG_CARD_BY_ID,
        stage,
        waitingPlayers,
        lastRound,
      },
    });
  },
  bot: { choose: () => ({ type: 'draw_card', payload: {} }) },
});
