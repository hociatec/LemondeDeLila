import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
  inventory,
  when,
} from '../../../engine/sdk/public-api';
import { PIMP_MY_RIDE_CAR_NAMES, PIMP_MY_RIDE_DECK } from './content';
import {
  currentCarParts,
  drawCarPart,
  PIMP_MY_RIDE_ACTIONS,
  PIMP_CAR_NAME_INDEX,
} from './rules';
import type { CarProgress, PimpMyRideState } from './state';

type CompletedCarView = {
  name: string;
  description: string;
  parts: string[];
};

type PimpMyRidePlayerView = {
  progress: Record<
    number,
    Omit<CarProgress, 'completedCars'> & { completedCars: CompletedCarView[] }
  >;
};

const cardSchema = defineCardsSchema({
  decks: {
    'car-parts': cards.deck({
      id: 'car-parts',
      cards: PIMP_MY_RIDE_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'car-parts',
      initial: 3,
      visibility: 'owner',
    }),
  },
});

export default defineGame<PimpMyRideState>()({
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
      schema: cardSchema,
      deckId: 'car-parts',
      handId: 'players',
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
  viewExtension: ({ state, ctx }): PimpMyRidePlayerView => {
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
    return { progress };
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
