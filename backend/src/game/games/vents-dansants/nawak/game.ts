import {
  defineGame,
  playerView,
  simultaneous,
} from '../../../core/application/public-api';
import { NAWAK_CHALLENGES } from './content';
import { NAWAK_ACTIONS, NAWAK_TARGET_SCORE, nawakStage } from './rules';
import type { NawakPlayerView, NawakState } from './state';

export default defineGame<NawakState, typeof NAWAK_ACTIONS, NawakPlayerView>({
  id: 'nawak',
  displayName: 'Nawak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description:
    'Répondez aux défis absurdes puis votez pour une réponse étrangère.',
  players: { min: 2, max: 8 },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'choose_answer' },
    { key: 'V', type: 'action', actionType: 'vote_answer' },
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  setup: ({ ctx }) => {
    ctx.submissions.open({ id: 'nawak.answers', secret: true });
    ctx.turn.waitForAll('nawak.answers');
    return {
      currentChallengeId: (
        ctx.random.pick(NAWAK_CHALLENGES) ?? NAWAK_CHALLENGES[0]
      ).id,
      lastRound: null,
    };
  },
  turn: simultaneous(),
  actions: NAWAK_ACTIONS,
  view: ({ state, ctx }) => {
    const currentChallenge =
      NAWAK_CHALLENGES.find(
        (challenge) => challenge.id === state.currentChallengeId,
      ) ?? NAWAK_CHALLENGES[0];
    const scores = Object.fromEntries(
      ctx.players.all().map((player) => [player.id, ctx.score.get(player.id)]),
    );
    const lastRound = state.lastRound
      ? {
          ...structuredClone(state.lastRound),
          prompt:
            NAWAK_CHALLENGES.find(
              (challenge) => challenge.id === state.lastRound?.challengeId,
            )?.prompt ?? '',
        }
      : null;
    const roundStage = nawakStage(ctx);
    const revealAnswers = roundStage === 'vote';
    const submissions = ctx.submissions.values<number>('nawak.answers');
    const votes =
      roundStage === 'vote'
        ? ctx.submissions.values<number>('nawak.votes')
        : {};
    return playerView({
      game: {
        targetScore: NAWAK_TARGET_SCORE,
        scores,
        currentChallenge: structuredClone(currentChallenge),
        lastRound,
        roundStage,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        submissions: revealAnswers ? submissions : {},
        votes: {},
      },
      extras: {
        hand: [...currentChallenge.answers],
        targetScore: NAWAK_TARGET_SCORE,
        scores: structuredClone(scores),
        stage: roundStage,
        challenge: structuredClone(currentChallenge),
        submissions: revealAnswers ? submissions : {},
        submissionCount: Object.keys(submissions).length,
        voteCount: Object.keys(votes).length,
        lastRound: structuredClone(lastRound),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      if (nawakStage(ctx) === 'choose') {
        return {
          type: 'choose_answer',
          payload: { answerIndex: ctx.random.int(3) },
        };
      }
      const targets = Object.keys(
        ctx.submissions.values<number>('nawak.answers'),
      )
        .map(Number)
        .filter((playerId) => playerId !== actor.id);
      const targetPlayerId = ctx.random.pick(targets);
      return targetPlayerId == null
        ? null
        : { type: 'vote_answer', payload: { targetPlayerId } };
    },
  },
});
