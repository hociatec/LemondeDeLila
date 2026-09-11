import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import {
  defineChoice,
  gameInput,
  roundScoring,
  when,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import {
  LAMA_PHASES,
  prepareLamaRound,
  resolvePause,
  resolveReturn,
  scoreLamaRound,
  skipInactiveLamaPlayer,
} from './rules';
export type LamaState = NoGameState;
export const scoring = roundScoring<LamaState>({
  score: ({ state, ctx }) => scoreLamaRound(state, ctx),
});
export const GAME_RULES = {
  lifecycle: {
    ...scoring.lifecycle,
    onRoundStart: ({ state, ctx }) => prepareLamaRound(state, ctx),
  },
  choices: {
    'lama.return': defineChoice<LamaState, number>({
      input: gameInput.number({ integer: true, min: 0, max: 10 }),
      resolve: ({ state, value, ctx }) => resolveReturn(state, value, ctx),
    }),
    'lama.pause': defineChoice<LamaState, string>({
      input: gameInput.literal('continue'),
      resolve: ({ state, ctx }) => resolvePause(state, ctx),
    }),
  },
  automatic: [
    when(
      'skip-inactive-lama-player',
      ({ state: _state, ctx }) => {
        const currentId = ctx.players.current()?.id ?? 0;
        return (
          LAMA_PHASES.is(ctx, 'turn') &&
          !ctx.round.activePlayers().some((player) => player.id === currentId)
        );
      },
      ({ state, ctx }) => skipInactiveLamaPlayer(state, ctx),
    ),
  ],
} satisfies GameRuleBindings<LamaState>;
