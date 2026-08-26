import {
  cards,
  defineGame,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import { ZIG_ET_ZAG_CARD_BY_ID, ZIG_ET_ZAG_DECK } from './content';
import { createRound, ZIG_ET_ZAG_ACTIONS } from './rules';
import type { ZigEtZagPlayerView, ZigEtZagState } from './state';

const deck = cards.deck({
  id: 'battle',
  cards: ZIG_ET_ZAG_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'battle',
  initial: 27,
  visibility: 'owner',
});

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
  components: [deck, hands],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw_card' }],
  setup: ({ players, ctx }) => ({
    initialDeckCounts: Object.fromEntries(
      players.map((player) => [
        player.id,
        ctx.cards.hand<string>('players', player.id).length,
      ]),
    ),
    round: createRound(ctx),
    lastRound: null,
    winnerId: null,
  }),
  turn: standardTurn(),
  actions: ZIG_ET_ZAG_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'all-cards-captured' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const { round: _round, ...publicState } = state;
    return playerView({
      game: {
        ...structuredClone(publicState),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        stage: state.round.stage,
        waitingPlayers: [...state.round.waitingPlayers],
      },
      extras: {
        hand: hand.map((cardId) => ZIG_ET_ZAG_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        stage: state.round.stage,
        waitingPlayers: [...state.round.waitingPlayers],
        lastRound: structuredClone(state.lastRound),
      },
    });
  },
  bot: { choose: () => ({ type: 'draw_card', payload: {} }) },
});
