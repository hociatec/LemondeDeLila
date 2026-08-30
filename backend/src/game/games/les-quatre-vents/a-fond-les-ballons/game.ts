import {
  cards,
  defineCardsSchema,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_PAWNS,
  A_FOND_LES_BALLONS_TILES,
} from './content';
import {
  A_FOND_LES_BALLONS_ACTIONS,
  A_FOND_LES_BALLONS_EFFECTS,
  A_FOND_LES_BALLONS_PHASES,
  requestPawn,
  resolvePawn,
} from './rules';
import type { NoGameState as AFondLesBallonsState } from '../../../engine/sdk/public-api';

const cardSchema = defineCardsSchema({
  decks: {
    loufoque: cards.deck({
      id: 'loufoque',
      cards: A_FOND_LES_BALLONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<AFondLesBallonsState>()({
  id: 'a-fond-les-ballons',
  displayName: 'A fond les ballons !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course déjantée jusqu’à la Grosse Noix Dorée.',
  players: { min: 2, max: 6 },
  content: defineGameContent('a-fond-les-ballons', {
    cards: A_FOND_LES_BALLONS_CARDS,
    pawns: A_FOND_LES_BALLONS_PAWNS,
    tiles: A_FOND_LES_BALLONS_TILES,
  }),
  patterns: [
    raceGame({
      trackId: 'balloons',
      spaces: A_FOND_LES_BALLONS_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'balloons-pawns', pawns: A_FOND_LES_BALLONS_PAWNS }),
    ...cardSchema.components,
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ ctx }) => {
    const starterId = ctx.round.starter();
    if (starterId != null) requestPawn(starterId, ctx);
    return {};
  },
  initialPhase: A_FOND_LES_BALLONS_PHASES.initialPhase,
  phases: A_FOND_LES_BALLONS_PHASES.phases,
  actions: A_FOND_LES_BALLONS_ACTIONS,
  effects: A_FOND_LES_BALLONS_EFFECTS,
  choices: {
    'a-fond-les-ballons.pawn': defineChoice<AFondLesBallonsState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
