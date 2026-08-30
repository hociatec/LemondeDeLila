import {
  cards,
  defineCardsSchema,
  defineChoice,
  defineGameContent,
  defineGame,
  gameInput,
  raceGame,
} from '../../../engine/sdk/public-api';
import { MISSION_GALAXIE_CONTENT } from './content';
import {
  MISSION_GALAXIE_ACTIONS,
  MISSION_GALAXIE_EFFECTS,
  resolveMissionAnswer,
  resolveMissionEventMove,
} from './rules';
import type { MissionGalaxieState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    questions: cards.deck({
      id: 'questions',
      cards: MISSION_GALAXIE_CONTENT.questions,
      shuffle: true,
    }),
    challenges: cards.deck({
      id: 'challenges',
      cards: MISSION_GALAXIE_CONTENT.challenges,
      shuffle: true,
    }),
    events: cards.deck({
      id: 'events',
      cards: MISSION_GALAXIE_CONTENT.events,
      shuffle: true,
    }),
  },
  hands: {},
});

export default defineGame<MissionGalaxieState>()({
  id: 'mission-galaxie',
  displayName: 'Mission Galaxie',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description:
    'Une course cosmique rythmée par questions, défis et événements.',
  players: { min: 2, max: 6 },
  content: defineGameContent('mission-galaxie', MISSION_GALAXIE_CONTENT),
  patterns: [
    raceGame({
      trackId: 'galaxy',
      spaces: MISSION_GALAXIE_CONTENT.tiles.length,
    }),
  ],
  components: [...cardSchema.components],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  actions: MISSION_GALAXIE_ACTIONS,
  effects: MISSION_GALAXIE_EFFECTS,
  choices: {
    'mission-galaxie.answer': defineChoice<MissionGalaxieState, number>({
      input: gameInput.number({ integer: true, min: 0 }),
      resolve: ({ state, value, ctx }) =>
        resolveMissionAnswer(state, value, ctx),
    }),
    'mission-galaxie.event-move': defineChoice<MissionGalaxieState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) =>
        resolveMissionEventMove(state, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
