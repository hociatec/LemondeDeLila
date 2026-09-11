import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type MissionGalaxieTileType =
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

export interface MissionGalaxieChoiceCard {
  id: number;
  title: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
}

export interface MissionGalaxieEventCard {
  id: number;
  title: string;
  description: string;
  effects: readonly GameEffectInstruction[];
  moveDeltas?: readonly number[];
}

export type MissionGalaxiePending =
  | {
      kind: 'answer';
      actorId: number;
      deck: 'questions' | 'challenges';
      cardId: number;
    }
  | {
      kind: 'event-move';
      actorId: number;
      cardId: number;
    };

export type MissionGalaxieState =
  import('../../../engine/sdk/public-api').NoGameState;
