export type AventureSauvageTileType = 'neutral' | 'animal' | 'patte' | 'finish';

export type AventureSauvageTile = {
  type: AventureSauvageTileType;
  label: string;
  description?: string;
};

export type AventureSauvageCardDeck = 'animal' | 'patte';

export type AventureSauvagePawn = {
  id: string;
  label: string;
  description: string;
};

export type AventureSauvagePawnJson = {
  id: string;
  title: string;
  description?: string;
};

export type AventureSauvagePawnsJsonV1 = {
  version: 1;
  pawns: AventureSauvagePawnJson[];
};

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
  pawns?: AventureSauvagePawn[];
  pawnByPlayerId?: Record<number, string>;
  setupStarterId?: number | null;
  decks: {
    animal: AventureSauvageCard[];
    patte: AventureSauvageCard[];
    discardAnimal: AventureSauvageCard[];
    discardPatte: AventureSauvageCard[];
  };
  winnerId: number | null;
};
