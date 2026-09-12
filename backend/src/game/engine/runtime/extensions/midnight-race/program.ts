/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type MidnightRaceProgram = {
  trackId: string;
  diceId: string;
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  answerChoiceId: string;
  maxDepth: number;
  finishReason: string;
  statuses: {
    ignoreNextMalus: string;
    ignoreNextSkip: string;
    forceDrawNextTurn: string;
  };
  tiles: readonly {
    n: number;
    title: string;
    type: 'start' | 'neutral' | 'card' | 'move' | 'skip' | 'finish';
    delta: number;
    skipTurns: number;
  }[];
  cards: readonly {
    id: number;
    title: string;
    effects: readonly GameEffectInstruction[];
    quiz?: {
      prompt: string;
      choices: readonly string[];
      correctIndex: number;
      successDelta: number;
      failureDelta: number;
      anyCorrect?: boolean;
    };
  }[];
};
