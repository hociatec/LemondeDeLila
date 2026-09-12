/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type DerapeRaceProgram = {
  trackId: string;
  diceId: string;
  deckId: string;
  nextDeltaChoiceId: string;
  maxDepth: number;
  finishReason: string;
  resources: { lastRoll: string; lastMove: string; idleTurns: string };
  counterId: string;
  mirrorStatusId: string;
  tiles: readonly { label: string; description: string; isNeutral: boolean }[];
  cards: readonly {
    id: number;
    title: string;
    text: string;
    kind:
      | 'move'
      | 'skip'
      | 'special'
      | 'global'
      | 'conditional'
      | 'rule'
      | 'neutral';
    moveDelta?: number;
    effects: readonly GameEffectInstruction[];
  }[];
};
