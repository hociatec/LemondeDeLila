import type { GameEffectInstruction } from './effect-ir';

export type CatPattesObstacle =
  'gamelle' | 'pluie' | 'chien' | 'coussin' | 'sol';
export type CatPattesParade =
  'croquettes' | 'rayon' | 'dodo' | 'coussin' | 'saut';
export type CatPattesPower =
  'reserve' | 'chat-ninja' | 'patte-blindee' | 'passage-star';

type CardBase = {
  id: string;
  name: string;
  description?: string;
  effect?: string;
  effects: readonly GameEffectInstruction[];
};

export type CatPattesCard = CardBase &
  (
    | { type: 'pattes'; value: number }
    | { type: 'obstacle'; obstacle: CatPattesObstacle }
    | { type: 'parade'; parade: CatPattesParade }
    | { type: 'bot'; bot: CatPattesPower }
  );

export type CatPattesProgram = {
  deckId: string;
  handId: string;
  trackId: string;
  goal: number;
  initialHandSize: number;
  defaultRounds: number;
  statusPrefix: string;
  cards: readonly CatPattesCard[];
};
