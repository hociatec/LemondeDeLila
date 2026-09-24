import type { TrackRaceProgram } from '../../../engine/sdk/extension-contracts';

/** A race that transports cards to numbered destinations while events block paths. */
export type DeliveryRaceProgram = TrackRaceProgram & {
  clientDeckId: string;
  clientHandId: string;
  eventDeckId: string;
  destinationAttribute: string;
  blockedPositionAttribute: string;
  positionOffset: number;
  targetScore: number;
  eventNamespace: string;
  tiles: readonly { id: string | number; title: string }[];
};
