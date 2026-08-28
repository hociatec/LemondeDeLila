import type { GameEffectInstruction } from '../../../core/application/public-api';

export type VoyageTileType =
  | 'start'
  | 'finish'
  | 'neutral'
  | 'rest'
  | 'passage'
  | 'legend'
  | 'farce'
  | 'treasure'
  | 'landscape';

export interface VoyageTile {
  id: number;
  title: string;
  type: VoyageTileType;
  label?: string;
  description?: string;
  passageEffect?: { kind: 'swap-position' } | { kind: 'move'; delta: number };
}

export interface VoyageCard {
  id: number;
  title: string;
  description: string;
  effect: string;
  effects: readonly GameEffectInstruction[];
  collectionGain: VoyageCollectionKind | null;
  discardAfterResolve: boolean;
  quiz?: VoyageQuiz;
}

export type VoyageQuiz = {
  choices: string[];
  answer: string;
  successDelta: number;
};

export type VoyageCollectionKind =
  'legend' | 'farce' | 'treasure' | 'landscape';

export type VoyageCollection = Record<VoyageCollectionKind, number>;

export type VoyagePendingChoice = {
  kind: 'quiz';
  actorId: number;
  cardId: number;
};

export type VoyageState = Record<string, never>;
