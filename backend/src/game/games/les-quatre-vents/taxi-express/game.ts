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
const cardSchema = defineCardsSchema({
  decks: {
    events: cards.deck({ id: 'events', cards: TAXI_EVENTS, shuffle: true }),
    clients: cards.deck({
      id: 'clients',
      cards: TAXI_CLIENTS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    'taxi-clients': cards.hands({
      id: 'taxi-clients',
      deck: 'clients',
      initial: 0,
      visibility: 'owner',
    }),
  },
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
      schema: cardSchema,
      deckId: 'clients',
      handId: 'taxi-clients',
    }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  initialPhase: TAXI_PHASES.initialPhase,
  phases: TAXI_PHASES.phases,
  actions: TAXI_ACTIONS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
