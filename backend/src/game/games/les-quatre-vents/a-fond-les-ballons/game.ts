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
  requestPawns,
  resolvePawn,
  type AFondLesBallonsState,
} from './rules';

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
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    {
      key: 'Space',
      type: 'action',
      actionType: 'draw_card',
      label: 'Piocher',
    },
  ],
  setup: ({ ctx }) => {
    const participants = ctx.players.all();
    requestPawns(
      [
        ...participants.filter((player) => !player.isBot),
        ...participants.filter((player) => player.isBot),
      ].map((player) => player.id),
      ctx,
    );
    return { awaitingCardDraw: false };
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
  bot: {
    choose: ({ availableActions }) =>
      availableActions.includes('draw_card')
        ? { type: 'draw_card', payload: {} }
        : { type: 'roll', payload: {} },
  },
});
