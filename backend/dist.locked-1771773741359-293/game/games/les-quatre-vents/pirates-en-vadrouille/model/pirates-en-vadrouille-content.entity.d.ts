import type { PiratesEnVadrouilleTile, PiratesEnVadrouilleTreasureCard, PiratesEnVadrouilleObstacleCard, PiratesEnVadrouilleBonusCard } from './pirates-en-vadrouille-state.entity';
export type PiratesEnVadrouilleBoardJsonV1 = {
    version: 1;
    tiles: PiratesEnVadrouilleTile[];
};
export type PiratesEnVadrouilleCardsJsonV1 = {
    version: 1;
    treasure: PiratesEnVadrouilleTreasureCard[];
    obstacle: PiratesEnVadrouilleObstacleCard[];
    bonus: PiratesEnVadrouilleBonusCard[];
};
