export interface NawakChallenge {
  id: string;
  prompt: string;
  answers: [string, string, string];
}

export type NawakStage = 'choose' | 'vote';

export interface NawakRoundSummary {
  challengeId: string;
  prompt: string;
  submissions: Record<number, number>;
  votes: Record<number, number>;
  pointsAwarded: Record<number, number>;
  tie: boolean;
}

export interface NawakState {
  targetScore: number;
  scores: Record<number, number>;
  currentChallenge: NawakChallenge;
  roundStage: NawakStage;
  submissions: Record<number, number>;
  votes: Record<number, number>;
  lastRound: NawakRoundSummary | null;
  winnerId: number | null;
}

export type NawakPlayerView = NawakState;
