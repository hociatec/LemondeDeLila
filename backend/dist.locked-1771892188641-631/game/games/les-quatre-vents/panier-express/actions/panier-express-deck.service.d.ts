import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
export declare class PanierExpressDeckService {
    private readonly deckPool;
    private readonly random;
    constructor(deckPool: DeckPoolService, random: RandomService);
    drawCard<T = string>(meta: PanierExpressMetadata, key: string): {
        card: T | null;
        metadata: PanierExpressMetadata;
    };
    drawWithReplenish<T = string>(meta: PanierExpressMetadata, key: string, replenish: () => T[]): {
        card: T | null;
        metadata: PanierExpressMetadata;
    };
    replenishDeck<T = string>(meta: PanierExpressMetadata, key: string, cards: T[]): PanierExpressMetadata;
}
