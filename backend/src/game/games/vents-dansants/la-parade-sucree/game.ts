import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  INITIAL_CANDIES,
  PARADE_CARD_BY_ID,
  PARADE_CARDS,
  PARADE_SEQUENCE,
} from './content';
import { PARADE_ACTIONS, winners } from './rules';
import type { LaParadeSucreePlayerView, LaParadeSucreeState } from './state';

const deck = cards.deck({
  id: 'parade',
  cards: PARADE_CARDS.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'parade',
  initial: 0,
  visibility: 'owner',
});

export default defineGame<
  LaParadeSucreeState,
  typeof PARADE_ACTIONS,
  LaParadeSucreePlayerView
>({
  id: 'la-parade-sucree',
  displayName: 'La Parade Sucrée !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Posez les cartes dans l’ordre et collectionnez les friandises.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    ctx.cards.deal(
      'parade',
      'players',
      players.map((player) => player.id),
      PARADE_CARDS.length,
    );
    return {
      candies: Object.fromEntries(
        players.map((player) => [player.id, structuredClone(INITIAL_CANDIES)]),
      ),
      sequenceIndex: 0,
      played: [],
    };
  },
  turn: clockwise(),
  actions: PARADE_ACTIONS,
  victory: victoryWhen(({ state, ctx }) => {
    const complete =
      state.sequenceIndex >= PARADE_SEQUENCE.length ||
      ctx.players
        .all()
        .every((player) => ctx.cards.hand('players', player.id).length === 0);
    return complete
      ? { winnerPlayerIds: winners(state), reason: 'parade-complete' }
      : null;
  }),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const handCounts = ctx.cards.handCounts('players');
    const nextCard = PARADE_SEQUENCE[state.sequenceIndex] ?? null;
    const scoreLines = ctx.players
      .all()
      .map(
        (player) =>
          `${player.username}: ${handCounts[player.id] ?? 0} carte(s)`,
      );
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts,
        nextCard,
      },
      extras: {
        hand: structuredClone(hand),
        handCounts,
        candies: structuredClone(state.candies),
        nextCard,
        played: state.played.map(
          (cardId) => PARADE_CARD_BY_ID[cardId]?.name ?? cardId,
        ),
        ui: {
          panels: {
            hand: { title: 'Main', message: hand.join(', ') || 'Main vide.' },
            score: { title: 'Cartes', message: scoreLines.join('\n') },
          },
        },
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const expected = PARADE_SEQUENCE[state.sequenceIndex];
      const cardId = ctx.cards
        .hand<string>('players', actor.id)
        .find((candidate) => PARADE_CARD_BY_ID[candidate]?.value === expected);
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
