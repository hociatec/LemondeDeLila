import type { GameEffectInstruction } from '../../../engine/runtime/contracts/effect-ir';
import type { TrackRaceProgram } from '../../../engine/runtime/contracts/track-race-contract';
import type { directionalHazardCardKinds } from './directional-hazard-effect-types';

export type DirectionalHazardRaceProgram = TrackRaceProgram & {
  /** Omitted in historical games, which retain finish-line victory. */
  victoryMode?: 'arrival' | 'external';
  parameters: {
    checkpointSpan: number;
    shieldAdvance: number;
    replayAdvance: number;
    swapAdvance: number;
    leaderRetreat: number;
    othersAdvance: number;
    lastAdvance: number;
    retreatRecovery: number;
    checkpointSuccess: number;
    checkpointFailure: number;
    idleThreshold: number;
    idleAdvance: number;
    sharedAdvance: number;
    randomSides: number;
    globalRetreat: number;
    globalAdvance: number;
  };
  deckId: string;
  nextDeltaChoiceId: string;
  maxDepth: number;
  resources: { lastRoll: string; lastMove: string; idleTurns: string };
  counterId: string;
  mirrorStatusId: string;
  tiles: readonly { label: string; description: string; isNeutral: boolean }[];
  cards: readonly {
    id: number;
    title: string;
    text: string;
    kind: (typeof directionalHazardCardKinds)[number];
    moveDelta?: number;
    effects: readonly GameEffectInstruction[];
  }[];
};
