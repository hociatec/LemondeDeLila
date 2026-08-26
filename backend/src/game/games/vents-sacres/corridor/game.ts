import {
  defineGame,
  grid,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  CORRIDOR_DEFAULT_WALLS,
  CORRIDOR_PAWNS,
  CORRIDOR_SIZE,
} from './content';
import {
  CORRIDOR_ACTIONS,
  legalMoves,
  legalWalls,
  requestConfig,
  resolveConfig,
  resolvePawn,
} from './rules';
import type { CorridorPlayerView, CorridorState } from './state';

export default defineGame<
  CorridorState,
  typeof CORRIDOR_ACTIONS,
  CorridorPlayerView
>({
  id: 'corridor',
  displayName: 'Le Corridor',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Atteignez le bord opposé sans fermer tous les chemins.',
  players: { min: 2, max: 2 },
  components: [
    grid.board({ id: 'corridor', width: CORRIDOR_SIZE, height: CORRIDOR_SIZE }),
  ],
  shortcuts: [
    { key: 'Enter', type: 'action', actionType: 'corridor_move' },
    { key: 'M', type: 'action', actionType: 'corridor_place_wall' },
  ],
  setup: ({ players, ctx }) => {
    const center = Math.floor(CORRIDOR_SIZE / 2);
    const state: CorridorState = {
      size: CORRIDOR_SIZE,
      ownerPlayerId: players[0].id,
      wallsPerPlayer: CORRIDOR_DEFAULT_WALLS,
      pawnByPlayerId: {},
      positions: {
        [players[0].id]: { x: center, y: 0 },
        [players[1].id]: { x: center, y: CORRIDOR_SIZE - 1 },
      },
      goalYByPlayerId: {
        [players[0].id]: CORRIDOR_SIZE - 1,
        [players[1].id]: 0,
      },
      walls: [],
      wallsRemaining: Object.fromEntries(
        players.map((player) => [player.id, CORRIDOR_DEFAULT_WALLS]),
      ),
      setupComplete: false,
      winnerId: null,
    };
    requestConfig(state, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: standardTurn(),
  actions: CORRIDOR_ACTIONS,
  choices: {
    'corridor.config': {
      resolve: ({ state, value, ctx }) =>
        resolveConfig(state, Number(value), ctx),
    },
    'corridor.pawn': {
      resolve: ({ state, actor, value, ctx }) =>
        resolvePawn(state, actor.id, String(value), ctx),
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'opposite-edge' },
  ),
  view: ({ state, actor, ctx }) => {
    const moves =
      actor && ctx.turn.is(actor.id) && state.setupComplete
        ? legalMoves(state, actor.id, ctx)
        : [];
    const walls =
      actor && ctx.turn.is(actor.id) && state.setupComplete
        ? legalWalls(state, actor.id, ctx)
        : [];
    return playerView({
      game: {
        ...structuredClone(state),
        legalMoves: moves,
        legalWalls: walls,
      },
      extras: {
        pawns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [
              player.id,
              CORRIDOR_PAWNS.find(
                (pawn) => pawn.id === state.pawnByPlayerId[player.id],
              ) ?? null,
            ]),
        ),
        grid: {
          kind: 'grid',
          size: state.size,
          entities: ctx.players.all().map((player) => ({
            id: `pawn:${player.id}`,
            type: 'pawn',
            ownerId: player.id,
            ...state.positions[player.id],
          })),
          walls: structuredClone(state.walls),
          legalMoves: moves,
          legalWalls: walls,
        },
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const move = legalMoves(state, actor.id, ctx)[0];
      return move
        ? { type: 'corridor_move', payload: { x: move.x, y: move.y } }
        : null;
    },
  },
});
