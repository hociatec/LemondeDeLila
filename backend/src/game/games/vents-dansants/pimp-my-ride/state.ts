import type { PlayerMap } from '../../../core/application/public-api';

export interface CompletedCarState {
  nameIndex: number;
  parts: string[];
}

export interface CompletedCarView {
  name: string;
  description: string;
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

export type PimpMyRidePlayerView = {
  carNameIndex: number;
  progress: Record<
    number,
    Omit<CarProgress, 'completedCars'> & { completedCars: CompletedCarView[] }
  >;
  drawnPlayerId: number | null;
  drawnCardId: string | null;
  winnerId: number | null;
};
