import type { EffectCondition, GameEffectInstruction } from './effect-ir';

export type TriggerSource =
  | { kind: 'action'; type: string }
  | {
      kind: 'event';
      type: string;
      equals?: Readonly<Record<string, string | number | boolean>>;
    };

export type DeclarativeTrigger = {
  readonly id: string;
  readonly on: TriggerSource;
  readonly condition?: EffectCondition;
  readonly effects: readonly GameEffectInstruction[];
};
