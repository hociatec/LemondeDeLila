import type { PlayerMap } from '../../../engine/sdk/public-api';

export interface CompletedCarState {
  nameIndex: number;
  parts: string[];
}

export interface CarProgress {
  stageIndex: number;
  carParts: string[];
  completedCars: CompletedCarState[];
}

export interface PimpMyRideState {
  completedCars: PlayerMap<CompletedCarState[]>;
}
