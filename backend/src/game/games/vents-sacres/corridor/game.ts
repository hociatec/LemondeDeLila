import {
  defineChoice,
  defineConfiguration,
  defineGame,
  defineGameContent,
  gameInput,
  gridGame,
  pawns,
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
  legalMoves,
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
  content: defineGameContent('corridor', {
    size: CORRIDOR_SIZE,
    defaultWallsPerPlayer: CORRIDOR_DEFAULT_WALLS,
    pawns: CORRIDOR_PAWNS,
  }),
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
  viewFragment: ({ state }) => ({ walls: structuredClone(state.walls) }),
  bot: {
    choose: ({ state, actor, ctx }) => {
      const move = legalMoves(state, actor.id, ctx)[0];
      return move
        ? { type: 'corridor_move', payload: { x: move.x, y: move.y } }
        : null;
    },
  },
});
