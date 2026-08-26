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
import { MINUIT_CARDS, MINUIT_PAWNS, MINUIT_TILES } from './content';
import {
  MINUIT_ACTIONS,
  requestPawn,
  resolvePawn,
  resolvePending,
  skipMinuitPlayer,
} from './rules';
import type { MinuitPlayerView, MinuitState } from './state';

export default defineGame<MinuitState, typeof MINUIT_ACTIONS, MinuitPlayerView>(
  {
    id: 'en-attendant-minuit',
    displayName: 'En Attendant Minuit !',
    category: 'JeuxDePlateaux',
    subcategory: 'LesQuatreVents',
    description: 'Course de Noël jusqu’à la grande fête de Minuit.',
    players: { min: 2, max: 6 },
    components: [
      movement.track({ id: 'minuit', spaces: MINUIT_TILES.length }),
      diceKit({ id: 'main', count: 1, sides: 6 }),
      cards.deck({ id: 'noel', cards: MINUIT_CARDS, shuffle: true }),
    ],
    shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
    setup: ({ players, ctx }) => {
      const state: MinuitState = {
        pawnByPlayerId: {},
        setupComplete: false,
        starterId: players[0].id,
        skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
        ignoreNextMalus: Object.fromEntries(
          players.map((player) => [player.id, false]),
        ),
        ignoreNextSkip: Object.fromEntries(
          players.map((player) => [player.id, false]),
        ),
        forceDrawNextTurn: Object.fromEntries(
          players.map((player) => [player.id, false]),
        ),
        keepTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
        pendingResolution: null,
        winnerId: null,
      };
      requestPawn(state, players[0].id, ctx);
      return state;
    },
    initialPhase: 'setup',
    turn: clockwise(),
    actions: MINUIT_ACTIONS,
    choices: {
      'minuit.pawn': {
        resolve: ({ state, actor, value, ctx }) =>
          resolvePawn(state, actor.id, String(value), ctx),
      },
      'minuit.resolve': {
        resolve: ({ state, value, ctx }) =>
          resolvePending(state, Number(value), ctx),
      },
    },
    automatic: [
      when(
        'skip-minuit-player',
        ({ state, ctx }) =>
          state.setupComplete &&
          (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
        ({ state, ctx }) => skipMinuitPlayer(state, ctx),
      ),
    ],
    victory: victoryWhen(({ state }) =>
      state.winnerId == null
        ? null
        : { winnerPlayerIds: [state.winnerId], reason: 'midnight' },
    ),
    view: ({ state, actor, ctx }) => {
      const { pendingResolution, ...publicState } = state;
      const positions = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [
            player.id,
            ctx.movement.position('minuit', player.id),
          ]),
      );
      const pendingQuiz =
        pendingResolution?.kind === 'quiz' &&
        pendingResolution.actorId === actor?.id
          ? {
              cardId: pendingResolution.cardId,
              prompt: pendingResolution.prompt,
              choices: [...pendingResolution.choices],
            }
          : null;
      return playerView({
        game: {
          ...structuredClone(publicState),
          positions,
          deckCount:
            ctx.cards.deckCount('noel') + ctx.cards.discardCount('noel'),
        },
        extras: {
          pawn: actor
            ? (MINUIT_PAWNS.find(
                (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
              ) ?? null)
            : null,
          pendingQuiz,
        },
        board: { tiles: MINUIT_TILES, positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);
