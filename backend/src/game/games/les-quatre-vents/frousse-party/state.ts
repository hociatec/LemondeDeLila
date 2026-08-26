import type { FrousseBlock } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export type FrousseState = Record<string, never>;

export type FroussePlayerView = {
  ignoreNextTrap: PlayerMap<boolean>;
  ignoreTrapUntilNextDraw: PlayerMap<boolean>;
  ignoreNextPrank: PlayerMap<boolean>;
  ignoreNextGhost: PlayerMap<boolean>;
  nextMoveCap: PlayerMap<number>;
  nextRollMalus: PlayerMap<number>;
  nextRollKeepLowest: PlayerMap<boolean>;
  nextRollDouble: PlayerMap<boolean>;
  nextRollIfThreeBackTwo: PlayerMap<boolean>;
  blocked: PlayerMap<FrousseBlock | null>;
  pawnByPlayerId: PlayerMap<string>;
  starterId: number;
  replayTurns: PlayerMap<number>;
  positions: PlayerMap<number>;
  winnerId: number | null;
  skipTurns: PlayerMap<number>;
  setupComplete: boolean;
};
