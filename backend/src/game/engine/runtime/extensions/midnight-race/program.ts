/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type MidnightRaceProgram = TrackRaceProgram & {
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  answerChoiceId: string;
  maxDepth: number;
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
