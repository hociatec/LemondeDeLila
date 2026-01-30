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

export type MissionGalaxieTile = {
  n: number;
  title: string;
  type: MissionGalaxieTileType;
  delta?: number;
  skipTurns?: number;
  target?: number;
  keepTurn?: boolean;
};

export type MissionGalaxieChoiceCard = {
  id: number;
  title: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
};

export type MissionGalaxieEventEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'none' }
  | { kind: 'reroll' }
  | { kind: 'keepTurn' }
  | { kind: 'goto'; target: number }
  | { kind: 'skipOthers'; turns: number }
  | { kind: 'choosePlayerMove'; deltas: number[] };

export type MissionGalaxieEventCard = {
  id: number;
  title: string;
  description: string;
  effect: MissionGalaxieEventEffect;
};

export type MissionGalaxieDeckName = 'questions' | 'challenges' | 'events';

export type MissionGalaxiePendingContext =
  | {
      kind: 'question';
      actorId: number;
      card: MissionGalaxieChoiceCard;
    }
  | {
      kind: 'challenge';
      actorId: number;
      card: MissionGalaxieChoiceCard;
    }
  | {
      kind: 'choosePlayerMove';
      actorId: number;
      deltas: number[];
    };

export type MissionGalaxieMetadata = {
  tiles: MissionGalaxieTile[];
  positions: Record<number, number>;
  statuses: { skipTurn: Record<number, number> };
  decks: {
    questions: MissionGalaxieChoiceCard[];
    challenges: MissionGalaxieChoiceCard[];
    events: MissionGalaxieEventCard[];
  };
  discards: {
    questions: MissionGalaxieChoiceCard[];
    challenges: MissionGalaxieChoiceCard[];
    events: MissionGalaxieEventCard[];
  };
  pendingContext: MissionGalaxiePendingContext | null;
  winnerId: number | null;
};
