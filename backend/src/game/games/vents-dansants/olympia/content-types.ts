import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
export type OlympiaCategory =
  | 'divinite'
  | 'heros'
  | 'creature'
  | 'exploit'
  | 'action'
  | 'attaque'
  | 'evenement';
export type OlympiaDeckType =
  | 'divinite'
  | 'heros'
  | 'creatures'
  | 'exploits'
  | 'actions'
  | 'attaques'
  | 'evenements';
export type OlympiaStatusKey =
  | 'block_play'
  | 'block_hero'
  | 'block_exploit'
  | 'block_hero_exploit'
  | 'shield'
  | 'halved_gains'
  | 'neutralize_creature'
  | 'double_exploit'
  | 'divinity_block'
  | 'global_block_hero'
  | 'global_block_exploit'
  | 'block_draw_hero'
  | 'exploit_bonus'
  | 'event_protection'
  | 'block_actions'
  | 'exploit_penalty';
export type OlympiaEffect =
  | {
      type: 'prestige';
      target: 'self' | 'target' | 'all' | 'others';
      value: number;
    }
  | { type: 'steal'; value: number }
  | {
      type: 'draw';
      target: 'self' | 'all';
      amount: number;
      decks: OlympiaDeckType[];
    }
  | {
      type: 'status';
      key: OlympiaStatusKey;
      target: 'self' | 'target' | 'all' | 'others';
      turns: number;
      value?: number;
    }
  | {
      type: 'discard';
      target: 'target' | 'all';
      categories: OlympiaCategory[];
      amount: number;
    }
  | { type: 'exchange'; categories: OlympiaCategory[] }
  | { type: 'skip'; target: 'target'; turns: number };

export interface OlympiaCardDefinition {
  id: string;
  name: string;
  description: string;
  category: OlympiaCategory;
  deck: OlympiaDeckType;
  points?: number;
  effect?: OlympiaEffect | OlympiaEffect[];
  effects: readonly GameEffectInstruction[];
}

export const OLYMPIA_CATEGORIES: OlympiaCategory[] = [
  'divinite',
  'heros',
  'creature',
  'exploit',
  'action',
  'attaque',
  'evenement',
];
export const OLYMPIA_DECK_TYPES: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];
export const OLYMPIA_STATUS_KEYS: OlympiaStatusKey[] = [
  'block_play',
  'block_hero',
  'block_exploit',
  'block_hero_exploit',
  'shield',
  'halved_gains',
  'neutralize_creature',
  'double_exploit',
  'divinity_block',
  'global_block_hero',
  'global_block_exploit',
  'block_draw_hero',
  'exploit_bonus',
  'event_protection',
  'block_actions',
  'exploit_penalty',
];
