import type { GameEffectInstruction } from './effect-ir';

/** Shared identity and executable instructions for cards carrying effects. */
export type EffectCard<TId extends string | number = string | number> = {
  id: TId;
  effects: readonly GameEffectInstruction[];
};
