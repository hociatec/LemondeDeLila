import {
  cards,
  defineChoice,
  defineGamePhases,
  defineGame,
  defineGameContent,
  gameInput,
  raceGame,
} from '../../../engine/sdk/public-api';
import { CA_DERAPE_CARDS, CA_DERAPE_TILES } from './content';
import {
  CA_DERAPE_ACTIONS,
  CA_NEXT_PLAYER_DELTA,
  resolveDeltaChoice,
} from './rules';
import { CA_DERAPE_EFFECTS } from './effects';
import type { NoGameState as CaDerapeState } from '../../../engine/sdk/public-api';

const CA_DERAPE_PHASES = defineGamePhases<CaDerapeState>()({
  initialPhase: 'playing',
  phases: { playing: {} },
});

export default defineGame<CaDerapeState, typeof CA_DERAPE_ACTIONS>({
  id: 'ca-derape',
  displayName: 'Ça Dérape !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course chaotique sur 30 cases avec cartes Situation.',
  players: { min: 2, max: 10 },
  content: defineGameContent('ca-derape', {
    cards: CA_DERAPE_CARDS,
    tiles: CA_DERAPE_TILES,
  }),
  patterns: [raceGame({ trackId: 'derape', spaces: CA_DERAPE_TILES.length })],
  components: [
    cards.deck({ id: 'situations', cards: CA_DERAPE_CARDS, shuffle: true }),
  ],
  initialization: {
    counters: { [CA_NEXT_PLAYER_DELTA]: 0 },
    startRound: false,
  },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  initialPhase: CA_DERAPE_PHASES.initialPhase,
  phases: CA_DERAPE_PHASES.phases,
  actions: CA_DERAPE_ACTIONS,
  effects: CA_DERAPE_EFFECTS,
  choices: {
    'ca-derape.next-delta': defineChoice<CaDerapeState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ value, ctx }) => resolveDeltaChoice(value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
