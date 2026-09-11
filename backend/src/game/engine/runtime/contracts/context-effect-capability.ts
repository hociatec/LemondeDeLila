import type { EffectSource, GameEffectInstruction } from './effect-ir';

/** Author effect commands; draining, resumption and debug access belong to runtime. */
export interface ContextEffectCapability {
  source(): EffectSource | null;
  sourcePlayerId(): number | null;
  recordSource(source: EffectSource): void;
  clearSource(): void;
  run(...effects: readonly GameEffectInstruction[]): void;
  schedule(...effects: readonly GameEffectInstruction[]): void;
  awaitsChoice(choiceId: string): boolean;
  isResolving(): boolean;
}
