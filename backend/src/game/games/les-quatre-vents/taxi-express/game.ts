import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import { TAXI_CLIENTS, TAXI_EVENTS, TAXI_TILES } from './content';
import { TAXI_ACTIONS } from './rules';
import type { TaxiPlayerView, TaxiState } from './state';

export default defineGame<TaxiState, typeof TAXI_ACTIONS, TaxiPlayerView>({
  id: 'taxi-express',
  displayName: 'Taxi Express',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Déposez cinq clients en évitant les rues bloquées.',
  players: { min: 2, max: 5 },
  components: [
    movement.track({ id: 'city', spaces: TAXI_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({ id: 'clients', cards: TAXI_CLIENTS, shuffle: true }),
    cards.deck({ id: 'events', cards: TAXI_EVENTS, shuffle: true }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players }) => ({
    activeClients: Object.fromEntries(
      players.map((player) => [player.id, null]),
    ),
    completedTrips: Object.fromEntries(players.map((player) => [player.id, 0])),
    lastEvent: null,
    lastRoll: null,
    winnerId: null,
  }),
  initialPhase: 'playing',
  turn: clockwise(),
  actions: TAXI_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'five-trips' },
  ),
  view: ({ state, actor, ctx }) => {
    const { activeClients: _activeClients, ...publicState } = state;
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, ctx.movement.position('city', player.id)]),
    );
    return playerView({
      game: {
        ...structuredClone(publicState),
        positions,
        activeClient: actor
          ? structuredClone(state.activeClients[actor.id])
          : null,
        hasActiveClient: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [
              player.id,
              state.activeClients[player.id] != null,
            ]),
        ),
      },
      board: { tiles: TAXI_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
