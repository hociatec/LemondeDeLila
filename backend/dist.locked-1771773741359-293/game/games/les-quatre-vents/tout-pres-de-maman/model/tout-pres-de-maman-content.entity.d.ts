import type { ToutPresDeMamanCard, ToutPresDeMamanTile } from './tout-pres-de-maman-state.entity';
export interface ToutPresDeMamanBoardJsonV1 {
    version: 1;
    tiles: ToutPresDeMamanTile[];
}
export interface ToutPresDeMamanCardsJsonV1 {
    version: 1;
    cards: ToutPresDeMamanCard[];
}
