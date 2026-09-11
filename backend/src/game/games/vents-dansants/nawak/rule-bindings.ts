import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import type { NawakState } from './state';
export type NawakPlayerView = Pick<
  NawakState,
  'currentChallengeId' | 'lastRound'
>;
export const GAME_RULES = {
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
} satisfies GameRuleBindings<NawakState, NawakPlayerView>;
