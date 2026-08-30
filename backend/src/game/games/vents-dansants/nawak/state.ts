import type { PlayerMap } from '../../../engine/sdk/public-api';

export interface NawakChallenge {
  id: string;
  prompt: string;
  answers: [string, string, string];
}

export type NawakStage = 'choose' | 'vote';

export interface NawakRoundState {
  challengeId: string;
  submissions: PlayerMap<number>;
  votes: PlayerMap<number>;
  pointsAwarded: PlayerMap<number>;
  tie: boolean;
}

export interface NawakState {
  currentChallengeId: string;
  lastRound: NawakRoundState | null;
}
