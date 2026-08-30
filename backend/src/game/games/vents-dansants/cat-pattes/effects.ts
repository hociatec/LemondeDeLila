import {
  defineEffect,
  gameInput,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import type { CatPattesBotType, CatPattesParadeType } from './content';
import { CAT_PATTES_GOAL } from './content';
import { applyParade, applyPower } from './rules';
import { CAT_TURBO_PLAYED, completeCatPattesRound } from './round-rules';
type CatPattesState = NoGameState;

const PARADES = ['croquettes', 'rayon', 'dodo', 'coussin', 'saut'] as const;
const POWERS = [
  'reserve',
  'chat-ninja',
  'patte-blindee',
  'passage-star',
] as const;

export const CAT_PATTES_EFFECTS = {
  'cat-pattes.move': defineEffect<CatPattesState, { value: number }>({
    input: gameInput.object({
      value: gameInput.number({ integer: true, min: 1 }),
    }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId == null) return;
      const position = ctx.movement.move(
        'cat-pattes',
        actorPlayerId,
        data.value,
      );
      if (data.value === 150) {
        ctx.resources.add(actorPlayerId, CAT_TURBO_PLAYED, 1);
      }
      if (position === CAT_PATTES_GOAL) {
        completeCatPattesRound(actorPlayerId, ctx);
      } else {
        ctx.turn.end();
      }
    },
  }),
  'cat-pattes.parade': defineEffect<
    CatPattesState,
    { parade: CatPattesParadeType }
  >({
    input: gameInput.object({ parade: gameInput.enum(PARADES) }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) applyParade(actorPlayerId, data.parade, ctx);
    },
  }),
  'cat-pattes.power': defineEffect<CatPattesState, { power: CatPattesBotType }>(
    {
      input: gameInput.object({ power: gameInput.enum(POWERS) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null) applyPower(actorPlayerId, data.power, ctx);
      },
    },
  ),
} as const;
