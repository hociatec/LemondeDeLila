export const directionalHazardSpecialEffects = [
  'take-lead',
  'move-and-shield',
  'leapfrog',
  'next-multiple-five',
  'move-and-replay',
  'move-and-swap',
] as const;
export type DirectionalHazardSpecialEffect =
  (typeof directionalHazardSpecialEffects)[number];

export const directionalHazardGlobalEffects = [
  'shuffle',
  'reverse-ranking',
  'skip-all',
  'advance-all',
  'retreat-all',
  'cycle-ranking',
  'random-roll-all',
] as const;
export type DirectionalHazardGlobalEffect =
  (typeof directionalHazardGlobalEffects)[number];

export const directionalHazardConditionalEffects = [
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
export type DirectionalHazardConditionalEffect =
  (typeof directionalHazardConditionalEffects)[number];

export const directionalHazardRuleEffects = [
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
export type DirectionalHazardRuleEffect =
  (typeof directionalHazardRuleEffects)[number];
