import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { MINUIT_CARDS, MINUIT_PAWNS, MINUIT_TILES } from './content';
import {
  MINUIT_ACTIONS,
  MINUIT_EFFECTS,
  MINUIT_PHASES,
  requestPawn,
  resolvePawn,
  resolvePending,
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
    patterns: [
      raceGame({
        trackId: 'minuit',
        spaces: MINUIT_TILES.length,
        overshoot: 'bounce',
      }),
    ],
    components: [
      pawns.set({ id: 'minuit', pawns: MINUIT_PAWNS }),
      cards.deck({
        id: 'noel',
        cards: MINUIT_CARDS,
        shuffle: true,
        empty: 'recycle',
      }),
    ],
    initialization: { firstPlayer: 'first', startRound: true },
    shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
    setup: ({ players, ctx }) => {
      requestPawn(players[0].id, ctx);
      return {};
    },
    initialPhase: MINUIT_PHASES.initialPhase,
    phases: MINUIT_PHASES.phases,
    actions: MINUIT_ACTIONS,
    effects: MINUIT_EFFECTS,
    choices: {
      'minuit.pawn': defineChoice<MinuitState, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
      }),
      'minuit.resolve': defineChoice<MinuitState, number>({
        input: gameInput.number({ integer: true }),
        resolve: ({ state, value, ctx }) =>
          resolvePending(state, value, ctx),
      }),
    },
    view: ({ actor, ctx }) => {
      const pawnByPlayerId = Object.fromEntries(
        ctx.players.all().flatMap((player) => {
          const pawnId = ctx.pawns.assigned('minuit', player.id)[0];
          return pawnId == null ? [] : [[player.id, pawnId]];
        }),
      );
      const pendingResolution = ctx.choice.data<
        import('./state').MinuitPending
      >();
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
          ? (() => {
              const card = MINUIT_CARDS.find(
                (candidate) => candidate.id === pendingResolution.cardId,
              );
              return card?.quiz
                ? {
                    cardId: card.id,
                    prompt: card.quiz.prompt,
                    choices: [...card.quiz.choices],
                  }
                : null;
            })()
          : null;
      const statusMap = (statusId: string) =>
        Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.status.has(player.id, statusId)]),
        );
      return playerView({
        game: {
          ignoreNextMalus: statusMap('minuit.ignore-next-malus'),
          ignoreNextSkip: statusMap('minuit.ignore-next-skip'),
          forceDrawNextTurn: statusMap('minuit.force-draw-next-turn'),
          pawnByPlayerId,
          starterId: ctx.round.starter() ?? 0,
          keepTurns: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [player.id, ctx.turn.extraCount(player.id)]),
          ),
          positions,
          winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
          skipTurns: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
          ),
          setupComplete: MINUIT_PHASES.is(ctx, 'playing'),
        },
        extras: {
          pawn: actor
            ? (MINUIT_PAWNS.find(
                (pawn) => pawn.id === pawnByPlayerId[actor.id],
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
