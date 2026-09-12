import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type QuizEventRaceTile = {
  n: number;
  title: string;
  type:
    | 'start'
    | 'neutral'
    | 'question'
    | 'challenge'
    | 'event'
    | 'move'
    | 'skip'
    | 'finish'
    | 'swapNearest'
    | 'goto';
  delta?: number;
  turnsToSkip?: number;
  target?: number;
  keepTurn?: boolean;
};
export type QuizEventChoiceCard = {
  id: number;
  title: string;
  prompt: string;
  choices: readonly string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
};

export type QuizEventEventCard = {
  id: number;
  title: string;
  description: string;
  effects: readonly GameEffectInstruction[];
  moveDeltas?: readonly number[];
};

export type QuizEventRaceProgram = TrackRaceProgram & {
  questionDeckId: string;
  challengeDeckId: string;
  eventDeckId: string;
  answerChoiceId: string;
  eventMoveChoiceId: string;
  tiles: readonly QuizEventRaceTile[];
  questions: readonly QuizEventChoiceCard[];
  challenges: readonly QuizEventChoiceCard[];
  events: readonly QuizEventEventCard[];
  maxDepth: number;
};
