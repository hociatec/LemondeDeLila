import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type ThemeNameCardsSpecialEffect =
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
  names: readonly ThemeNameCardsNameCard[];
  themes: readonly ThemeNameCardsThemeCard[];
  specialCards: readonly ThemeNameCardsSpecialCard[];
};
