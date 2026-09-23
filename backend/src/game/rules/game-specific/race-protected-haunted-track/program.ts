import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { TrackRaceProgram } from '../../../engine/runtime/contracts/track-race-contract';

export type ProtectedHauntedBlock =
  | { kind: 'one-of'; allowed: number[] }
  | { kind: 'minimum'; minimum: number }
  | { kind: 'even' };

export type ProtectedHauntedRaceProgram = TrackRaceProgram & {
  conditionalMove: { equals: number; delta: number };
  protections: readonly {
    category: string;
    status: string;
    consume: 'draw' | 'matching-card';
  }[];
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  swapChoiceId: string;
  maxChainDepth: number;
  eventNamespace: string;
  statuses: {
    ignoreNextTrap: string;
    ignoreTrapUntilNextDraw: string;
    ignoreNextPrank: string;
    ignoreNextGhost: string;
    nextMoveCap: string;
    nextRollMalus: string;
    nextRollKeepLowest: string;
    nextRollDouble: string;
    nextRollIfThreeBackTwo: string;
    blocked: string;
  };
  tiles: readonly {
    n: number;
    title: string;
    label: string;
    description: string;
    type: 'neutral' | 'card' | 'finish';
  }[];
  cards: readonly {
    id: number;
    localNumber: number;
    category: string;
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
