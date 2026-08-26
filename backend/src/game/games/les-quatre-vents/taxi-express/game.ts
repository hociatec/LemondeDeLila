import {
  cards,
  cardGame,
  defineGamePhases,
  defineGame,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import {
  TAXI_CLIENTS,
  TAXI_EVENTS,
  TAXI_TILES,
  type TaxiClient,
  type TaxiEvent,
} from './content';
import { TAXI_ACTIONS } from './rules';
import type { TaxiPlayerView, TaxiState } from './state';

const TAXI_PHASES = defineGamePhases<TaxiState>()({
  initialPhase: 'playing',
  phases: { playing: {} },
});

export default defineGame<TaxiState, typeof TAXI_ACTIONS, TaxiPlayerView>({
  id: 'taxi-express',
  displayName: 'Taxi Express',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Déposez cinq clients en évitant les rues bloquées.',
  players: { min: 2, max: 5 },
  patterns: [
    raceGame({ trackId: 'city', spaces: TAXI_TILES.length }),
    cardGame({
      deckId: 'clients',
      handId: 'taxi-clients',
      cards: TAXI_CLIENTS,
    }),
  ],
  components: [cards.deck({ id: 'events', cards: TAXI_EVENTS, shuffle: true })],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: () => ({}),
  initialPhase: TAXI_PHASES.initialPhase,
  phases: TAXI_PHASES.phases,
  actions: TAXI_ACTIONS,
  view: ({ actor, ctx }) => {
    const completedTrips = ctx.players.byId((player) =>
      ctx.score.get(player.id),
    );
    const lastEvent = ctx.cards.discardPile<TaxiEvent>('events').at(-1) ?? null;
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('city', player.id),
    );
    return playerView({
      game: {
        completedTrips,
        lastEvent,
        activeClient: actor
          ? (ctx.cards.hand<TaxiClient>('taxi-clients', actor.id)[0] ?? null)
          : null,
        hasActiveClient: ctx.players.byId(
          (player) =>
            ctx.cards.hand<TaxiClient>('taxi-clients', player.id).length > 0,
        ),
      },
      board: { tiles: TAXI_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
