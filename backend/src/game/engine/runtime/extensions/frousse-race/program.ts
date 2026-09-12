/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type FrousseBlock =
  | { kind: 'one-of'; allowed: number[] }
  | { kind: 'minimum'; minimum: number }
  | { kind: 'even' };

export type FrousseRaceProgram = TrackRaceProgram & {
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
    category: 'trap' | 'prank' | 'ghost' | 'bonus';
    text: string;
    effects: readonly GameEffectInstruction[];
  }[];
};
