import type {
  TaxiExpressEventCard,
  TaxiExpressClientCard,
  TaxiExpressTile,
} from './taxi-state.entity';

export interface TaxiExpressBoardJsonV1 {
  version: 1;
  tiles: TaxiExpressTile[];
}

export interface TaxiExpressClientsJsonV1 {
  version: 1;
  cards: TaxiExpressClientCard[];
}

export interface TaxiExpressEventsJsonV1 {
  version: 1;
  cards: TaxiExpressEventCard[];
}
