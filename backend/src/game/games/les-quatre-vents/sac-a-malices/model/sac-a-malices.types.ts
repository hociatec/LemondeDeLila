export type SacTileType =
  | 'start'
  | 'property'
  | 'station'
  | 'utility'
  | 'chance'
  | 'community'
  | 'tax'
  | 'jail'
  | 'go_to_jail'
  | 'free'
  | 'neutral';

export type SacTile = {
  n: number;
  title: string;
  description?: string;
  type: SacTileType;
  group?: string;
};

export type SacCard = { id: number; text: string };

export type SacDeck = { cards: SacCard[]; discard: SacCard[] };

export type SacGroupsJsonV1 = {
  version: 1;
  groups: Array<{
    color: string;
    properties: string[];
    purchasePrice: number;
    mortgage: number;
    unmortgageCost: number;
    rents: {
      base: number;
      house1: number;
      house2: number;
      house3: number;
      house4: number;
      hotel: number;
    };
    housePrice: number;
    hotelPrice: number;
  }>;
};

export type SacStationsJsonV1 = {
  version: 1;
  stations: {
    properties: string[];
    purchasePrice: number;
    mortgage: number;
    unmortgageCost: number;
    rents: Record<'1' | '2' | '3' | '4', number>;
  };
};

export type SacUtilitiesJsonV1 = {
  version: 1;
  utilities: Array<{
    name: string;
    purchasePrice: number;
    mortgage: number;
    unmortgageCost: number;
    multiplier1: number;
    multiplier2: number;
  }>;
};

export type SacBoardJsonV1 = { version: 1; tiles: SacTile[] };
export type SacCardsJsonV1 = { version: 1; cards: SacCard[] };

export type SacMetadata = {
  tiles: SacTile[];
  positions: Record<number, number>;
  money: Record<number, number>;
  ownership: Record<number, number>;
  buildings: Record<
    number,
    {
      houses: number;
      hotel: boolean;
      mortgaged: boolean;
    }
  >;
  statuses: {
    skipTurn: Record<number, number>;
    inJail: Record<number, number>;
    eliminated: Record<number, boolean>;
    getOutOfJail: Record<number, number>;
    extraRoll?: Record<number, boolean>;
    consecutiveDoubles?: Record<number, number>;
  };
  pot: number;
  decks: {
    chance: SacDeck;
    community: SacDeck;
  };
  data: {
    groups: SacGroupsJsonV1['groups'];
    stations: SacStationsJsonV1['stations'];
    utilities: SacUtilitiesJsonV1['utilities'];
  };
  winnerId?: number | null;
};
