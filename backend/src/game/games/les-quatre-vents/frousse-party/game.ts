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
import { FROUSSE_CARDS, FROUSSE_PAWNS, FROUSSE_TILES } from './content';
import {
  FROUSSE_ACTIONS,
  FROUSSE_EFFECTS,
  FROUSSE_PHASES,
  requestPawn,
  resolvePawn,
} from './rules';
import type { NoGameState as FrousseState } from '../../../engine/sdk/public-api';

export default defineGame<FrousseState>()({
  id: 'frousse-party',
  displayName: 'Frousse Party',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course mouvementée dans un manoir hanté.',
  players: { min: 2, max: 6 },
  content: defineGameContent('frousse-party', {
    tiles: FROUSSE_TILES,
    pawns: FROUSSE_PAWNS,
    cards: FROUSSE_CARDS,
  }),
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'manor',
      spaces: FROUSSE_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'frousse', pawns: FROUSSE_PAWNS }),
    cards.deck({
      id: 'frights',
      cards: FROUSSE_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    requestPawn(players[0].id, ctx);
    return {};
  },
  initialPhase: FROUSSE_PHASES.initialPhase,
  phases: FROUSSE_PHASES.phases,
  actions: FROUSSE_ACTIONS,
  effects: FROUSSE_EFFECTS,
  choices: {
    'frousse.pawn': defineChoice<FrousseState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
