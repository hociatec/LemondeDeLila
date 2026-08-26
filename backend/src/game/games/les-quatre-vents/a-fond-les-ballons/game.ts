import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_PAWNS,
  A_FOND_LES_BALLONS_TILES,
} from './content';
import {
  A_FOND_LES_BALLONS_ACTIONS,
  requestPawn,
  resolvePawn,
  resolveSwap,
  skipBlockedPlayer,
} from './rules';
import type { AFondLesBallonsPlayerView, AFondLesBallonsState } from './state';

export default defineGame<
  AFondLesBallonsState,
  typeof A_FOND_LES_BALLONS_ACTIONS,
  AFondLesBallonsPlayerView
>({
  id: 'a-fond-les-ballons',
  displayName: 'A fond les ballons !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course déjantée jusqu’à la Grosse Noix Dorée.',
  players: { min: 2, max: 6 },
  components: [
    movement.track({ id: 'balloons', spaces: A_FOND_LES_BALLONS_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({
      id: 'loufoque',
      cards: A_FOND_LES_BALLONS_CARDS,
      shuffle: true,
    }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const starter = ctx.random.pick(players) ?? players[0];
    const state: AFondLesBallonsState = {
      pawnByPlayerId: {},
      setupComplete: false,
      starterId: starter.id,
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      trapImmunityTurns: Object.fromEntries(
        players.map((player) => [player.id, 0]),
      ),
      lastRoll: null,
      extraTurn: false,
      swapPlayerId: null,
      winnerId: null,
    };
    ctx.turn.to(starter.id);
    requestPawn(state, starter.id, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: A_FOND_LES_BALLONS_ACTIONS,
  choices: {
    'a-fond-les-ballons.pawn': {
      resolve: ({ state, actor, value, ctx }) =>
        resolvePawn(state, actor.id, String(value), ctx),
    },
    'a-fond-les-ballons.swap': {
      resolve: ({ state, value, ctx }) =>
        resolveSwap(state, Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-balloon-player',
      ({ state, ctx }) =>
        state.setupComplete &&
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipBlockedPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'golden-nut' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('balloons', player.id),
        ]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        positions,
        deckCount:
          ctx.cards.deckCount('loufoque') + ctx.cards.discardCount('loufoque'),
      },
      extras: {
        pawn: actor
          ? (A_FOND_LES_BALLONS_PAWNS.find(
              (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
      },
      board: { tiles: A_FOND_LES_BALLONS_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
