export interface CompletedCar {
  name: string;
  description: string;
  parts: string[];
}

export interface CarProgress {
  stageIndex: number;
  carParts: string[];
  completedCars: CompletedCar[];
}

export interface PimpMyRideState {
  progress: Record<number, CarProgress>;
  drawnPlayerId: number | null;
  drawnCardId: string | null;
  carNameIndex: number;
  winnerId: number | null;
}

export type PimpMyRidePlayerView = PimpMyRideState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
