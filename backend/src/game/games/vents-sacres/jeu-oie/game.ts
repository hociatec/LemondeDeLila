import {
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { GOOSE_PAWNS, GOOSE_TILES } from './content';
import {
  assignPawn,
  initializeGoose,
  JEU_OIE_ACTIONS,
  skipGoosePlayer,
} from './rules';
import type { JeuOiePlayerView, JeuOieState } from './state';

const track = movement.track({ id: 'goose-board', spaces: GOOSE_TILES.length });

export default defineGame<
  JeuOieState,
  typeof JEU_OIE_ACTIONS,
  JeuOiePlayerView
>({
  id: 'jeu-oie',
  displayName: 'Jeu de l’oie',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: 'Course classique sur 63 cases et ses pièges.',
  players: { min: 2, max: 6 },
  components: [track, diceKit({ id: 'main', count: 1, sides: 6 })],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: ({ players, ctx }) => {
    const selectionOrder = ctx.random.shuffle(
      players.map((player) => player.id),
    );
    ctx.turn.to(selectionOrder[0]);
    const state: JeuOieState = {
      pawnByPlayerId: {},
      selectionOrder,
      selectionIndex: 0,
      setupComplete: false,
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      inWell: Object.fromEntries(players.map((player) => [player.id, false])),
      lastRoll: null,
      winnerId: null,
    };
    initializeGoose(state, ctx);
    return state;
  },
  turn: clockwise(),
  actions: JEU_OIE_ACTIONS,
  choices: {
    'goose.pawn': {
      resolve: ({ state, value, ctx }) => assignPawn(state, String(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-goose-player',
      ({ state, ctx }) =>
        state.setupComplete &&
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipGoosePlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'case-63' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('goose-board', player.id),
        ]),
    );
    const {
      selectionOrder: _selectionOrder,
      selectionIndex: _selectionIndex,
      ...publicGame
    } = state;
    return playerView({
      game: { ...structuredClone(publicGame), positions },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pawns: GOOSE_PAWNS,
        pawnByPlayerId: structuredClone(state.pawnByPlayerId),
      },
      board: { tiles: structuredClone(GOOSE_TILES), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
