export const derapeSpecialEffects = [
  'take-lead',
  'move-and-shield',
  'leapfrog',
  'next-multiple-five',
  'move-and-replay',
  'move-and-swap',
] as const;
export type DerapeSpecialEffect = (typeof derapeSpecialEffects)[number];

export const derapeGlobalEffects = [
  'shuffle',
  'reverse-ranking',
  'skip-all',
  'advance-all',
  'retreat-all',
  'cycle-ranking',
  'random-roll-all',
] as const;
export type DerapeGlobalEffect = (typeof derapeGlobalEffects)[number];

export const derapeConditionalEffects = [
  'leader-retreat-others-advance',
  'last-advance',
  'after-retreat',
  'cancel-skip',
  'multiple-five',
  'after-idle',
  'shared-position',
  'replay',
  'join-ahead',
  'after-one-step',
] as const;
export type DerapeConditionalEffect = (typeof derapeConditionalEffects)[number];

export const derapeRuleEffects = [
  'roll-two',
  'draw-extra',
  'double-move',
  'retreat-one',
  'shield',
  'advance-two',
  'choose-next-player',
  'choose-next-delta',
  'double-roll',
  'mirror-roll',
] as const;
export type DerapeRuleEffect = (typeof derapeRuleEffects)[number];
