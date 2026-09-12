/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type GalaxyRaceTile = {
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
export type GalaxyChoiceCard = {
  id: number;
  title: string;
  prompt: string;
  choices: readonly string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
};

export type GalaxyEventCard = {
  id: number;
  title: string;
  description: string;
  effects: readonly GameEffectInstruction[];
  moveDeltas?: readonly number[];
};

export type GalaxyRaceProgram = {
  trackId: string;
  diceId: string;
  questionDeckId: string;
  challengeDeckId: string;
  eventDeckId: string;
  answerChoiceId: string;
  eventMoveChoiceId: string;
  tiles: readonly GalaxyRaceTile[];
  questions: readonly GalaxyChoiceCard[];
  challenges: readonly GalaxyChoiceCard[];
  events: readonly GalaxyEventCard[];
  maxDepth: number;
  finishReason: string;
};
