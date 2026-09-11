import {
  cards,
  defineCardsSchema,
  defineGame,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  MISSION_GALAXIE_CONTENT,
  MISSION_GALAXIE_GAME_CONTENT,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, MISSION_GALAXIE_EFFECTS } from './rules';

import { MISSION_GALAXIE_ACTIONS } from './rules';
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
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: MISSION_GALAXIE_GAME_CONTENT,
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
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
