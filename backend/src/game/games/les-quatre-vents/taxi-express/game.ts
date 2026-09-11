import manifest from './manifest.json';
import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGamePhases,
  defineGame,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  TAXI_CLIENTS,
  TAXI_EVENTS,
  TAXI_TILES,
  TAXI_GAME_CONTENT,
} from './content';
import { TAXI_ACTIONS } from './rules';
import type { NoGameState as TaxiState } from '../../../engine/sdk/public-api';

const TAXI_PHASES = defineGamePhases<TaxiState>()({
  initialPhase: 'playing',
  phases: { playing: { terminal: true } },
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
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: TAXI_GAME_CONTENT,
  patterns: [
    raceGame({ trackId: 'city', spaces: TAXI_TILES.length }),
    cardGame({
      schema: cardSchema,
      deckId: 'clients',
      handId: 'taxi-clients',
    }),
  ],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  initialPhase: TAXI_PHASES.initialPhase,
  phases: TAXI_PHASES.phases,
  actions: TAXI_ACTIONS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
