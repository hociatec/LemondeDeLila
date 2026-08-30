import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGamePhases,
  defineGame,
  defineGameContent,
  raceGame,
} from '../../../engine/sdk/public-api';
import { TAXI_CLIENTS, TAXI_EVENTS, TAXI_TILES } from './content';
import { TAXI_ACTIONS } from './rules';
import type { NoGameState as TaxiState } from '../../../engine/sdk/public-api';

const TAXI_PHASES = defineGamePhases<TaxiState>()({
  initialPhase: 'playing',
  phases: { playing: {} },
});
const eventCards = defineCardsSchema({
  decks: {
    events: cards.deck({ id: 'events', cards: TAXI_EVENTS, shuffle: true }),
  },
  hands: {},
});

export default defineGame<TaxiState>()({
  id: 'taxi-express',
  displayName: 'Taxi Express',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Déposez cinq clients en évitant les rues bloquées.',
  players: { min: 2, max: 5 },
  content: defineGameContent('taxi-express', {
    clients: TAXI_CLIENTS,
    events: TAXI_EVENTS,
    tiles: TAXI_TILES,
  }),
  patterns: [
    raceGame({ trackId: 'city', spaces: TAXI_TILES.length }),
    cardGame({
      deckId: 'clients',
      handId: 'taxi-clients',
      cards: TAXI_CLIENTS,
    }),
  ],
  components: [...eventCards.components],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  initialPhase: TAXI_PHASES.initialPhase,
  phases: TAXI_PHASES.phases,
  actions: TAXI_ACTIONS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
