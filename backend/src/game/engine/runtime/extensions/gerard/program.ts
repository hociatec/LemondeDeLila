/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type GerardSpecialEffect =
  | 'sabotage'
  | 'double-prenom'
  | 'double-theme'
  | 'interdiction'
  | 'main-fantome'
  | 'defense-totale'
  | 'echange-force'
  | 'panique-generale'
  | 'retour-envoyeur'
  | 'theme-secret'
  | 'chuchotement-confus'
  | 'mega-combo'
  | 'inversion'
  | 'jury-mystere'
  | 'effet-domino'
  | 'prenom-fantome'
  | 'inversion-role'
  | 'chaos-temporel'
  | 'ultra-sabotage'
  | 'prenom-volant';

export type GerardNameCard = { id: string; name: string };
export type GerardThemeCard = { id: string; text: string };
export type GerardSpecialCard = {
  id: string;
  name: string;
  description: string;
  effect: GerardSpecialEffect;
  effects: readonly GameEffectInstruction[];
};
export type GerardProgram = {
  targetScore: number;
  names: readonly GerardNameCard[];
  themes: readonly GerardThemeCard[];
  specialCards: readonly GerardSpecialCard[];
};
