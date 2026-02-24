export interface PimpMyRideCompletedCar {
    name: string;
    description: string;
    parts: string[];
}
export interface PimpMyRidePlayerProgress {
    stageIndex: number;
    carParts: string[];
    completedCars: PimpMyRideCompletedCar[];
}
export interface PimpMyRideMetadata {
    rng?: Record<string, any>;
    deck: string[];
    discard: string[];
    hands: Record<number, string[]>;
    progress: Record<number, PimpMyRidePlayerProgress>;
    drawnPlayerId?: number | null;
    drawnCardId?: string | null;
    carNameIndex: number;
    winnerId?: number | null;
}
