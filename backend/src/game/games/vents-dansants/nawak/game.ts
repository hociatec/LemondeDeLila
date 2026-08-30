import {
  defineGame,
  defineGameContent,
  submissionJudgeGame,
} from '../../../engine/sdk/public-api';
import { NAWAK_CHALLENGES } from './content';
import {
  ANSWERS_REVEALED,
  NAWAK_ACTIONS,
  NAWAK_TARGET_SCORE,
  ROUND_STARTED,
  nawakStage,
} from './rules';
import type { NawakState } from './state';

type NawakPlayerView = Pick<NawakState, 'currentChallengeId' | 'lastRound'>;

export default defineGame<NawakState>()({
  id: 'nawak',
  displayName: 'Nawak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description:
    'Répondez aux défis absurdes puis votez pour une réponse étrangère.',
  players: { min: 2, max: 8 },
  events: [ANSWERS_REVEALED, ROUND_STARTED],
  content: defineGameContent('nawak', {
    challenges: NAWAK_CHALLENGES,
    targetScore: NAWAK_TARGET_SCORE,
  }),
  patterns: [
    submissionJudgeGame({
      submissionId: 'nawak.answers',
      voteId: 'nawak.votes',
      secret: true,
      targetScore: NAWAK_TARGET_SCORE,
      winnerReason: 'target-score',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'choose_answer' },
    { key: 'V', type: 'action', actionType: 'vote_answer' },
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  setup: ({ ctx }) => {
    ctx.submissionFlow.open({
      id: 'nawak.answers',
      secret: true,
      waitForAll: true,
    });
    return {
      currentChallengeId: (
        ctx.random.pick(NAWAK_CHALLENGES) ?? NAWAK_CHALLENGES[0]
      ).id,
      lastRound: null,
    };
  },
  actions: NAWAK_ACTIONS,
  viewExtension: ({ state }): NawakPlayerView => ({
    currentChallengeId: state.currentChallengeId,
    lastRound: state.lastRound
      ? {
          challengeId: state.lastRound.challengeId,
          submissions: { ...state.lastRound.submissions },
          votes: { ...state.lastRound.votes },
          pointsAwarded: { ...state.lastRound.pointsAwarded },
          tie: state.lastRound.tie,
        }
      : null,
  }),
  bot: {
    choose: ({ state: _state, actor, ctx }) => {
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
