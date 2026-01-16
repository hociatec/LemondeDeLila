export type AFondLesBallonsTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'folie'
  | 'piege'
  | 'glissade'
  | 'tornade'
  | 'chaton'
  | 'finish';

export type AFondLesBallonsTile = {
  type: AFondLesBallonsTileType;
  label: string;
  description?: string;
};

export type AFondLesBallonsCard = {
  id: number;
  text: string;
};

export type AFondLesBallonsCharacter = {
  id: string;
  name: string;
  description: string;
};

export type AFondLesBallonsPendingSwap = {
  type: 'swap';
  label: string;
  playerId: number;
  blocking: true;
  choices: string[];
  data: {
    targets: Array<{ targetPlayerId: number; targetUsername: string }>;
  };
};

export type AFondLesBallonsMetadata = {
  rng?: Record<string, any>;
  tiles: AFondLesBallonsTile[];
  positions: Record<number, number>;
  charactersByPlayerId: Record<number, AFondLesBallonsCharacter>;
  statuses: {
    skipTurn: Record<number, number>;
    trapImmunityTurns: Record<number, number>;
  };
  decks: {
    loufoque: AFondLesBallonsCard[];
    discardLoufoque: AFondLesBallonsCard[];
  };
  winnerId: number | null;
};
