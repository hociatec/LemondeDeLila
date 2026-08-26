import type { GameEffectInstruction } from '../../../core/application/public-api';

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

export interface MissionGalaxieTile {
  n: number;
  title: string;
  type: MissionGalaxieTileType;
  delta?: number;
  skipTurns?: number;
  target?: number;
  keepTurn?: boolean;
}

export interface MissionGalaxieChoiceCard {
  id: number;
  title: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
}

export type MissionGalaxieEventEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'none' }
  | { kind: 'reroll' }
  | { kind: 'keepTurn' }
  | { kind: 'goto'; target: number }
  | { kind: 'skipOthers'; turns: number }
  | { kind: 'choosePlayerMove'; deltas: number[] };

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

export type MissionGalaxieState = Record<string, never>;

export type MissionGalaxiePlayerView = Record<string, never>;
