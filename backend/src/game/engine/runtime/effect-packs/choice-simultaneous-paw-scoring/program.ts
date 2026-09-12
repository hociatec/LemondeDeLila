import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type PawScoringObstacle =
  'gamelle' | 'pluie' | 'chien' | 'coussin' | 'sol';
export type PawScoringParade =
  'croquettes' | 'rayon' | 'dodo' | 'coussin' | 'saut';
export type PawScoringPower =
  'reserve' | 'chat-ninja' | 'patte-blindee' | 'passage-star';

type CardBase = {
  id: string;
  name: string;
  description?: string;
  effect?: string;
  effects: readonly GameEffectInstruction[];
};
export type PawScoringCard = CardBase &
  (
    | { type: 'pattes'; value: number }
    | { type: 'obstacle'; obstacle: PawScoringObstacle }
    | { type: 'parade'; parade: PawScoringParade }
    | { type: 'bot'; bot: PawScoringPower }
  );

export type PawScoringProgram = {
  deckId: string;
  handId: string;
  trackId: string;
  goal: number;
  initialHandSize: number;
  defaultRounds: number;
  statusPrefix: string;
  cards: readonly PawScoringCard[];
};
