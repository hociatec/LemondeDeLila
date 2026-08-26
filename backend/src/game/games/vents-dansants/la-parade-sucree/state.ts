export type ParadeCandyType = 'Chamallow' | 'Chocobon' | 'Balisto';
export type CandyCounts = Record<ParadeCandyType, number>;

export interface LaParadeSucreeState {
  candies: Record<number, CandyCounts>;
  sequenceIndex: number;
  played: string[];
}

export interface LaParadeSucreePlayerView extends LaParadeSucreeState {
  hand: string[];
  handCounts: Record<number, number>;
  nextCard: string | null;
}
