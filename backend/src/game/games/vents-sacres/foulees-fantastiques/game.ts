import {
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawnRace,
} from '../../../engine/sdk/public-api';
import { FOULEES_BOARD, FOULEES_FAMILIES, FOULEES_PAWNS } from './content';
import {
  FOULEES_ACTIONS,
  FOULEES_PHASES,
  requestFamily,
  resolveFamilyChoice,
  resolvePawnChoice,
} from './rules';
import type { FouleesState } from './state';

const COLORS = ['Rouge', 'Bleu', 'Vert', 'Jaune'] as const;

export default defineGame<FouleesState, typeof FOULEES_ACTIONS>({
  id: 'foulees-fantastiques',
  displayName: 'Foulées Fantastiques !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Une course de quatre familles animales vers leur abri.',
  players: { min: 2, max: 4 },
  content: defineGameContent('foulees-fantastiques', {
    board: FOULEES_BOARD,
    families: FOULEES_FAMILIES,
    pawns: FOULEES_PAWNS,
    seatColors: COLORS,
  }),
  patterns: [
    pawnRace({
      pawnSetId: 'foulees',
      pawns: FOULEES_PAWNS,
      perPlayer: 4,
      spaces: FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength,
      initialPosition: -1,
      homeStretchFrom: FOULEES_BOARD.trackLength,
    }),
  ],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const state: FouleesState = {};
    const first = players[0];
    if (first) requestFamily(state, first.id, ctx);
    return state;
  },
  initialPhase: FOULEES_PHASES.initialPhase,
  phases: FOULEES_PHASES.phases,
  actions: FOULEES_ACTIONS,
  choices: {
    'foulees.family': defineChoice<FouleesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveFamilyChoice(state, value, actor.id, ctx),
    }),
    'foulees.move': defineChoice<FouleesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) => resolvePawnChoice(state, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
