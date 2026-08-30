export interface ZigEtZagPlayState {
  playerId: number;
  playedCards: string[];
}

export interface ZigEtZagPlay extends ZigEtZagPlayState {
  faceDownCard?: string;
  faceUpCard?: string;
  invalidJoker?: boolean;
}

export interface ZigEtZagRound {
  plays: ZigEtZagPlayState[];
  tiedPlayers: number[];
}

export interface ZigEtZagRoundSummary {
  roundNumber: number;
  roundWinnerPlayerId: number | null;
  cardsWon: number;
  plays: ZigEtZagPlayState[];
}

export interface ZigEtZagState {
  battle: ZigEtZagRound;
  lastRound: ZigEtZagRoundSummary | null;
}
