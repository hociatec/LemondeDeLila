import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { TrackRaceProgram } from '../../../engine/runtime/contracts/track-race-contract';

export type BounceQuizRaceProgram = TrackRaceProgram & {
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
