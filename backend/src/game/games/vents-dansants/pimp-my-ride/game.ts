import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { PIMP_MY_RIDE_CARD_BY_ID, PIMP_MY_RIDE_DECK } from './content';
import { drawCarPart, PIMP_MY_RIDE_ACTIONS } from './rules';
import type { PimpMyRidePlayerView, PimpMyRideState } from './state';

const deck = cards.deck({
  id: 'car-parts',
  cards: PIMP_MY_RIDE_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'car-parts',
  initial: 3,
  visibility: 'owner',
});

export default defineGame<
  PimpMyRideState,
  typeof PIMP_MY_RIDE_ACTIONS,
  PimpMyRidePlayerView
>({
  id: 'pimp-my-ride',
  displayName: 'Pimp My Ride',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Assemblez trois voitures dans l’ordre des sept pièces.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players }) => ({
    progress: Object.fromEntries(
      players.map((player) => [
        player.id,
        { stageIndex: 0, carParts: [], completedCars: [] },
      ]),
    ),
    drawnPlayerId: null,
    drawnCardId: null,
    carNameIndex: 0,
    winnerId: null,
  }),
  turn: clockwise(),
  actions: PIMP_MY_RIDE_ACTIONS,
  automatic: [
    when(
      'draw-car-part',
      ({ state, ctx }) =>
        state.drawnPlayerId !== (ctx.players.current()?.id ?? null),
      ({ state, ctx }) => drawCarPart(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'three-cars' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCount: ctx.cards.deckCount('car-parts'),
        discardCount: ctx.cards.discardCount('car-parts'),
      },
      extras: {
        hand: hand.map((cardId) => PIMP_MY_RIDE_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        progress: structuredClone(state.progress),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const play = PIMP_MY_RIDE_ACTIONS.play_card.availableInputs?.({
        state,
        actor,
        ctx,
      })[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
