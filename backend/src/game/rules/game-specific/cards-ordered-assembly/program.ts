export type CarAssemblyProgram = {
  deckId: string;
  handId: string;
  currentInventoryId: string;
  completedInventoryIds: readonly string[];
  completedNameResources: readonly string[];
  completedCountResource: string;
  carNameCounter: string;
  cards: readonly { id: string; name: string; category: string }[];
  categoryOrder: readonly string[];
  carNames: readonly { name: string; description: string }[];
  carsToWin: number;
  finishReason: string;
  eventNamespace: string;
};
