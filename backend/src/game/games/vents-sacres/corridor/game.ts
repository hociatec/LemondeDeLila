import {
  defineChoice,
  defineConfiguration,
  defineGame,
  gameInput,
  gridGame,
  pawns,
  playerView,
  publicFields,
} from '../../../core/application/public-api';
import {
  CORRIDOR_DEFAULT_WALLS,
  CORRIDOR_PAWNS,
  CORRIDOR_SIZE,
} from './content';
import {
  CORRIDOR_ACTIONS,
  CORRIDOR_PHASES,
  CORRIDOR_WALLS,
  corridorPositions,
  corridorWallsRemaining,
  legalMoves,
  legalWalls,
  resolvePawn,
  startCorridorSetup,
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
  patterns: [
    gridGame({
      boardId: 'corridor',
      width: CORRIDOR_SIZE,
      height: CORRIDOR_SIZE,
    }),
  ],
  config: defineConfiguration<CorridorState, { wallsPerPlayer: number }>({
    input: gameInput.object({
      wallsPerPlayer: gameInput.number({ integer: true, min: 0, max: 20 }),
    }),
    defaults: { wallsPerPlayer: CORRIDOR_DEFAULT_WALLS },
    phase: CORRIDOR_PHASES.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Configuration du Corridor',
      submitLabel: 'Choisir les pions',
    },
    onConfigured: ({ config, ctx }) =>
      startCorridorSetup(config.wallsPerPlayer, ctx),
  }),
  components: [pawns.set({ id: 'corridor', pawns: CORRIDOR_PAWNS })],
  initialization: {
    resources: { [CORRIDOR_WALLS]: CORRIDOR_DEFAULT_WALLS },
    startRound: false,
  },
  shortcuts: [
    { key: 'Enter', type: 'action', actionType: 'corridor_move' },
    { key: 'M', type: 'action', actionType: 'corridor_place_wall' },
  ],
  setup: ({ players, ctx }) => {
    const center = Math.floor(CORRIDOR_SIZE / 2);
    ctx.grid.set('corridor', { x: center, y: 0 }, players[0].id);
    ctx.grid.set(
      'corridor',
      { x: center, y: CORRIDOR_SIZE - 1 },
      players[1].id,
    );
    const state: CorridorState = {
      walls: [],
    };
    return state;
  },
  initialPhase: CORRIDOR_PHASES.initialPhase,
  phases: CORRIDOR_PHASES.phases,
  actions: CORRIDOR_ACTIONS,
  choices: {
    'corridor.pawn': defineChoice<CorridorState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  view: ({ state, actor, ctx }) => {
    const positions = corridorPositions(ctx);
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('corridor', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const goalYByPlayerId = ctx.players.byId((_player, index) =>
      index === 0 ? CORRIDOR_SIZE - 1 : 0,
    );
    const moves =
      actor && ctx.turn.is(actor.id) && CORRIDOR_PHASES.is(ctx, 'playing')
        ? legalMoves(state, actor.id, ctx)
        : [];
    const walls =
      actor && ctx.turn.is(actor.id) && CORRIDOR_PHASES.is(ctx, 'playing')
        ? legalWalls(state, actor.id, ctx)
        : [];
    return playerView({
      game: {
        ...publicFields(state, ['walls']),
        wallsRemaining: corridorWallsRemaining(ctx),
        size: CORRIDOR_SIZE,
        pawnByPlayerId,
        goalYByPlayerId,
        wallsPerPlayer:
          ctx.config.get<number>('wallsPerPlayer') ?? CORRIDOR_DEFAULT_WALLS,
        legalMoves: moves,
        legalWalls: walls,
      },
      extras: {
        pawns: ctx.players.byId(
          (player) =>
            CORRIDOR_PAWNS.find(
              (pawn) => pawn.id === pawnByPlayerId[player.id],
            ) ?? null,
        ),
        grid: {
          kind: 'grid',
          size: CORRIDOR_SIZE,
          entities: ctx.players.all().map((player) => ({
            id: `pawn:${player.id}`,
            type: 'pawn',
            ownerId: player.id,
            ...positions[player.id],
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
