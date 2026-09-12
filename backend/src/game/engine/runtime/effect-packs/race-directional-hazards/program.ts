import type { GameEffectInstruction } from '../../contracts/effect-ir';
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type DirectionalHazardRaceProgram = TrackRaceProgram & {
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
    kind:
      | 'move'
      | 'skip'
      | 'special'
      | 'global'
      | 'conditional'
      | 'rule'
      | 'neutral';
    moveDelta?: number;
    effects: readonly GameEffectInstruction[];
  }[];
};
