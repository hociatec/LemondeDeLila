import {
  cards,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  publicField,
  raceGame,
} from '../../../engine/sdk/public-api';
import { MINUIT_CARDS, MINUIT_PAWNS, MINUIT_TILES } from './content';
import {
  MINUIT_ACTIONS,
  MINUIT_EFFECTS,
  MINUIT_PHASES,
  requestPawn,
  resolvePawn,
  resolvePending,
} from './rules';
import type { MinuitState } from './state';

export default defineGame<MinuitState, typeof MINUIT_ACTIONS>({
  id: 'en-attendant-minuit',
  displayName: 'En Attendant Minuit !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course de Noël jusqu’à la grande fête de Minuit.',
  players: { min: 2, max: 6 },
  content: defineGameContent('en-attendant-minuit', {
    tiles: MINUIT_TILES,
    pawns: MINUIT_PAWNS,
    cards: MINUIT_CARDS,
  }),
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'minuit',
      spaces: MINUIT_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'minuit', pawns: MINUIT_PAWNS }),
    cards.deck({
      id: 'noel',
      cards: MINUIT_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    requestPawn(players[0].id, ctx);
    return {};
  },
  initialPhase: MINUIT_PHASES.initialPhase,
  phases: MINUIT_PHASES.phases,
  actions: MINUIT_ACTIONS,
  effects: MINUIT_EFFECTS,
  choices: {
    'minuit.pawn': defineChoice<MinuitState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
    'minuit.resolve': defineChoice<MinuitState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, value, ctx }) => resolvePending(state, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
