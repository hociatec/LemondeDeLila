import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type RitualFamilyCard = {
  id: string;
  type: 'family';
  name: string;
  familyId: string;
  familyName: string;
};
export type RitualSpecialEffect =
  | 'draw_two_choose_one'
  | 'draw_and_trigger'
  | 'collect_from_others'
  | 'take_from_discard'
  | 'mute_specials'
  | 'swap_hands'
  | 'free_family'
  | 'reshuffle_cycle'
  | 'peace_turns'
  | 'reveal_and_steal';

export type RitualSpecialCard = {
  id: string;
  type: 'special';
  name: string;
  description: string;
  effect: RitualSpecialEffect;
  effects: readonly GameEffectInstruction[];
};

export type RitualCard = RitualFamilyCard | RitualSpecialCard;
export type RitualPhasesProgram = {
  cards: readonly RitualCard[];
};
