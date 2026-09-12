import type { GameEffectInstruction } from './effect-ir';

export type RiteFamilyId =
  | 'symboles-sacres'
  | 'creatures-de-paques'
  | 'traditions-et-fetes'
  | 'gourmandises-objets'
  | 'nature-saisons';

export type RiteFamilyCard = {
  id: string;
  type: 'family';
  name: string;
  familyId: RiteFamilyId;
  familyName: string;
};

export type RiteSpecialEffect =
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

export type RiteSpecialCard = {
  id: string;
  type: 'special';
  name: string;
  description: string;
  effect: RiteSpecialEffect;
  effects: readonly GameEffectInstruction[];
};

export type RiteCard = RiteFamilyCard | RiteSpecialCard;
export type RitesProgram = {
  cards: readonly RiteCard[];
};
