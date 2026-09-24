import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';

export type ThemeNameCardsSpecialEffect = string;
export type ThemeNameOperation =
  | 'discard-target'
  | 'add-one-submission'
  | 'draw-second-prompt'
  | 'lock-card'
  | 'random-submit'
  | 'protect'
  | 'exchange-with-target'
  | 'redraw-all'
  | 'discard-attacker'
  | 'hide-prompt'
  | 'exchange-with-neighbor'
  | 'add-two-submissions'
  | 'reverse-pending'
  | 'select-judge'
  | 'increment-pending-submissions'
  | 'add-neutral-submission'
  | 'become-judge'
  | 'reopen-submissions'
  | 'discard-two-targets'
  | 'steal-from-target';

export type ThemeNameCardsNameCard = { id: string; name: string };
export type ThemeNameCardsThemeCard = { id: string; text: string };
export type ThemeNameCardsSpecialCard = {
  id: string;
  name: string;
  description: string;
  effect: ThemeNameCardsSpecialEffect;
  effects: readonly GameEffectInstruction[];
};
export type ThemeNameCardsProgram = {
  targetScore: number;
  finishReason: string;
  handSize: number;
  specialHandSize: number;
  maximumSubmission: number;
  redrawCount: number;
  specialRules: readonly {
    id: string;
    effectId: string;
    operation: ThemeNameOperation;
    targeting:
      'none' | 'held-card' | 'opponent' | 'two-opponents' | 'pending-opponent';
  }[];
  names: readonly ThemeNameCardsNameCard[];
  themes: readonly ThemeNameCardsThemeCard[];
  specialCards: readonly ThemeNameCardsSpecialCard[];
};
