export type AventureSauvageTileType = 'neutral' | 'animal' | 'patte' | 'finish';

export type AventureSauvageTile = {
  type: AventureSauvageTileType;
  label: string;
};

export type AventureSauvageCardDeck = 'animal' | 'patte';

export type AventureSauvageCard = {
  id: number;
  deck: AventureSauvageCardDeck;
  text: string;
  moveDelta?: number; // déplacement relatif
  skipTurns?: number; // perd n tour(s)
  reroll?: boolean; // rejoue
};

export type AventureSauvageMetadata = {
  tiles: AventureSauvageTile[];
  positions: Record<number, number>;
  statuses?: {
    skipTurn?: Record<number, number>;
  };
  decks: {
    animal: AventureSauvageCard[];
    patte: AventureSauvageCard[];
    discardAnimal: AventureSauvageCard[];
    discardPatte: AventureSauvageCard[];
  };
  winnerId: number | null;
};

