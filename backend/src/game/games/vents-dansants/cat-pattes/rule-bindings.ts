import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { type NoGameState, roundScoring } from '../../../engine/sdk/public-api';
import { resetCatPattesRound, scoreCatPattesRound } from './round-rules';
export const scoring = roundScoring<NoGameState>({
  score: ({ state, ctx }) => scoreCatPattesRound(state, ctx),
});
export const GAME_RULES = {
  lifecycle: {
    ...scoring.lifecycle,
    onRoundStart: ({ state, ctx }) => resetCatPattesRound(state, ctx),
  },
} satisfies GameRuleBindings<NoGameState>;
