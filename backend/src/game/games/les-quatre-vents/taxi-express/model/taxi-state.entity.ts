export type TaxiExpressTileType = 'start' | 'normal' | 'finish';

export type TaxiExpressTile = {
  id: number;
  title: string;
  type: TaxiExpressTileType;
  description?: string;
};

export type TaxiExpressClientCard = {
  id: number;
  clientName: string;
  destinationId: number;
  route: string;
};

export type TaxiExpressEventCard = {
  id: number;
  title: string;
  description: string;
  blockedTileId: number;
};

export type TaxiExpressDecks = {
  deckClients: number[];
  deckEvents: number[];
};

export type TaxiExpressDiscards = {
  discardClients: number[];
  discardEvents: number[];
};

export type TaxiExpressStatuses = {
  skipTurn: Record<number, number>;
};

export type TaxiExpressMetadata = TaxiExpressDecks &
  TaxiExpressDiscards & {
    tiles: TaxiExpressTile[];
    clients: TaxiExpressClientCard[];
    events: TaxiExpressEventCard[];
    positions: Record<number, number>;
    activeClients: Record<number, number | null>;
    completedTrips: Record<number, number>;
    blockedTileId: number | null;
    lastEventId: number | null;
    eventTurnPlayerId: number | null;
    statuses: TaxiExpressStatuses;
    pendingContext: null;
    winnerId: number | null;
  };

export type TaxiExpressPendingContext = null;
