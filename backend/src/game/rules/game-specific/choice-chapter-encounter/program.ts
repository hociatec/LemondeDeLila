import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';

export type ChapterEncounterCollectionKind = string;

export type ChapterEncounterCard = {
  id: number;
  title: string;
  description: string;
  effect: string;
  effects: readonly GameEffectInstruction[];
  collectionGain: ChapterEncounterCollectionKind | null;
  discardAfterResolve: boolean;
  quiz?: {
    choices: readonly { id: string; label: string }[];
    answerId: string;
    successDelta: number;
  };
};
export type ChapterEncounterProgram = {
  legacyQuizDeckId: string;
  tieBreakCollection: string;
  finishReason: string;
  trackId: string;
  diceId: string;
  choiceId: string;
  lastTargetStatusId: string;
  finishStartedCounterId: string;
  finishCountdownCounterId: string;
  collectionResourcePrefix: string;
  collectionKinds: readonly ChapterEncounterCollectionKind[];
  tiles: readonly {
    id: number;
    title: string;
    type: string;
    label?: string;
    description?: string;
    passageEffect?: { kind: 'swap-position' } | { kind: 'move'; delta: number };
  }[];
  decks: Readonly<
    Record<ChapterEncounterCollectionKind, readonly ChapterEncounterCard[]>
  >;
};
