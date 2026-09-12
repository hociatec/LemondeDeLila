/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
export type WonderMarketProgram = {
  marketId: string;
  inventoryId: string;
  currency: string;
  goods: readonly string[];
  turnsCounterId: string;
  maxRounds: number;
  rumorCost: number;
  protectCost: number;
  eventNamespace: string;
};
