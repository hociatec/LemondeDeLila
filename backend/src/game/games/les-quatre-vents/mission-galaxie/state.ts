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
  effect: MissionGalaxieEventEffect;
}

export type MissionGalaxiePending =
  | {
      kind: 'answer';
      actorId: number;
      card: MissionGalaxieChoiceCard;
    }
  | {
      kind: 'event-move';
      actorId: number;
      options: Array<{ targetId: number; delta: number }>;
    };

export interface MissionGalaxieState {
  skipTurns: Record<number, number>;
  lastRoll: number | null;
  winnerId: number | null;
  pendingChoice: MissionGalaxiePending | null;
}

export type MissionGalaxiePlayerView = Omit<
  MissionGalaxieState,
  'pendingChoice'
> & {
  positions: Record<number, number>;
  deckCounts: Record<'questions' | 'challenges' | 'events', number>;
};
