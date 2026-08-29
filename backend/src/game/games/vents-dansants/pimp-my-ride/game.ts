import {
  cardGame,
  defineGame,
  defineGameContent,
  inventory,
  when,
} from '../../../engine/sdk/public-api';
import { PIMP_MY_RIDE_CAR_NAMES, PIMP_MY_RIDE_DECK } from './content';
import {
  currentCarParts,
  drawCarPart,
  drawnCardId,
  PIMP_MY_RIDE_ACTIONS,
  PIMP_CAR_NAME_INDEX,
} from './rules';
import type { PimpMyRidePlayerView, PimpMyRideState } from './state';

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
  content: defineGameContent('pimp-my-ride', {
    cards: PIMP_MY_RIDE_DECK,
    carNames: PIMP_MY_RIDE_CAR_NAMES,
  }),
  patterns: [
    cardGame({
      deckId: 'car-parts',
      handId: 'players',
      cards: PIMP_MY_RIDE_DECK.map((card) => card.id),
      initialHandSize: 3,
    }),
  ],
  components: [
    inventory.set({
      id: 'pimp-my-ride.car-parts',
      items: PIMP_MY_RIDE_DECK.map((card) => card.id),
      visibility: 'public',
    }),
  ],
  initialization: {
    counters: { [PIMP_CAR_NAME_INDEX]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ ctx }) => {
    return {
      completedCars: ctx.players.byId(() => []),
    };
  },
  actions: PIMP_MY_RIDE_ACTIONS,
  automatic: [
    when(
      'draw-car-part',
      ({ ctx }) =>
        ctx.effects.sourcePlayerId() !== (ctx.players.current()?.id ?? null),
      ({ state, ctx }) => drawCarPart(state, ctx),
    ),
  ],
  viewExtension: ({ state, ctx }) => {
    const progress = ctx.players.byId((player) => {
      const carParts = currentCarParts(player.id, ctx);
      return {
        stageIndex: carParts.length,
        carParts,
        completedCars: state.completedCars[player.id].map((completed) => {
          const definition = PIMP_MY_RIDE_CAR_NAMES[completed.nameIndex];
          return {
            name: definition?.name ?? '',
            description: definition?.description ?? '',
            parts: [...completed.parts],
          };
        }),
      };
    });
    return { progress, drawnCardId: drawnCardId(ctx) };
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const play = PIMP_MY_RIDE_ACTIONS.play_card.enumerate?.({
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
