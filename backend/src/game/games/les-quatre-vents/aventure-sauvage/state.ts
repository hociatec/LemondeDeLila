export type AventureTileType = 'neutral' | 'animal' | 'patte' | 'finish';

export interface AventureTile {
  type: AventureTileType;
  label: string;
}

export interface AventurePawn {
  id: string;
  label: string;
  description: string;
}

export interface AventureCard {
  id: number;
  deck: 'animal' | 'patte';
  text: string;
  moveDelta?: number;
  skipTurns?: number;
  reroll?: boolean;
}

export interface AventureSauvageState {
  pawnByPlayerId: Record<number, string>;
  skipTurns: Record<number, number>;
  setupComplete: boolean;
  lastRoll: number | null;
  winnerId: number | null;
}

export type AventureSauvagePlayerView = AventureSauvageState & {
  positions: Record<number, number>;
  deckCounts: Record<'animal' | 'patte', number>;
};
