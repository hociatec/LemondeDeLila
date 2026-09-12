import type { GameEffectInstruction } from './effect-ir';

export type VoyageCollectionKind =
  'legend' | 'farce' | 'treasure' | 'landscape';

export type VoyageCard = {
  id: number;
  title: string;
  description: string;
  effect: string;
  effects: readonly GameEffectInstruction[];
  collectionGain: VoyageCollectionKind | null;
  discardAfterResolve: boolean;
  quiz?: {
    choices: readonly { id: string; label: string }[];
    answerId: string;
    successDelta: number;
  };
};

export type VoyageProgram = {
  trackId: string;
  diceId: string;
  choiceId: string;
  lastTargetStatusId: string;
  finishStartedCounterId: string;
  finishCountdownCounterId: string;
  collectionResourcePrefix: string;
  collectionKinds: readonly VoyageCollectionKind[];
  tiles: readonly {
    id: number;
    title: string;
    type:
      | 'start'
      | 'finish'
      | 'neutral'
      | 'rest'
      | 'passage'
      | VoyageCollectionKind;
    label?: string;
    description?: string;
    passageEffect?: { kind: 'swap-position' } | { kind: 'move'; delta: number };
  }[];
  decks: Readonly<Record<VoyageCollectionKind, readonly VoyageCard[]>>;
};
