/** A race that transports cards to numbered destinations while events block paths. */
export type DeliveryRaceProgram = {
  trackId: string;
  diceId: string;
  clientDeckId: string;
  clientHandId: string;
  eventDeckId: string;
  destinationAttribute: string;
  blockedPositionAttribute: string;
  positionOffset: number;
  targetScore: number;
  finishReason: string;
  eventNamespace: string;
  tiles: readonly { id: string | number; title: string }[];
};
