import canonicalContent from './catalogue.json';
import manifest from './manifest.json';

import { derapeSchema } from './content-schema';

import { cardContent, defineGameContent } from '../../../engine/sdk/public-api';

import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type CaCardKind =
  'move' | 'skip' | 'special' | 'global' | 'conditional' | 'rule' | 'neutral';

export type CaCard = {
  id: number;
  title: string;
  text: string;
  kind: CaCardKind;
  moveDelta?: number;
  effects: readonly GameEffectInstruction[];
};

export const CA_SPECIAL_EFFECTS = [
  'take-lead',
  'move-and-shield',
  'leapfrog',
  'next-multiple-five',
  'move-and-replay',
  'move-and-swap',
] as const;

export type CaSpecialEffect = (typeof CA_SPECIAL_EFFECTS)[number];

export const CA_GLOBAL_EFFECTS = [
  'shuffle',
  'reverse-ranking',
  'skip-all',
  'advance-all',
  'retreat-all',
  'cycle-ranking',
  'random-roll-all',
] as const;

export type CaGlobalEffect = (typeof CA_GLOBAL_EFFECTS)[number];

export const CA_CONDITIONAL_EFFECTS = [
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

export type CaConditionalEffect = (typeof CA_CONDITIONAL_EFFECTS)[number];

export const CA_RULE_EFFECTS = [
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

export type CaRuleEffect = (typeof CA_RULE_EFFECTS)[number];

export const CA_DERAPE_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = derapeSchema.parse(value);
        return { cards: cardContent(parsed.cards), tiles: parsed.tiles };
      },
    },
  },
);

export const CA_DERAPE_CARDS = CA_DERAPE_GAME_CONTENT.data.cards;

export const CA_DERAPE_TILES = CA_DERAPE_GAME_CONTENT.data.tiles;
