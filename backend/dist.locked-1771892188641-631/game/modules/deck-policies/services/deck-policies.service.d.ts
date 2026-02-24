import { RandomService } from '../../random/services/random.service';
type AnyMeta = Record<string, any>;
export declare class DeckPoliciesService {
    private readonly random;
    constructor(random: RandomService);
    drawFromPile<TCard = unknown, TMeta extends AnyMeta = AnyMeta>(params: {
        meta: TMeta;
        pile: TCard[];
        discard: TCard[];
        rngKey?: keyof TMeta & string;
        useWholeMetaRng?: boolean;
        discardDrawnCard?: boolean;
    }): {
        meta: TMeta;
        pile: TCard[];
        discard: TCard[];
        card: TCard | null;
        reshuffled: boolean;
    };
    drawOne<TCard = unknown, TMeta extends AnyMeta = AnyMeta>(params: {
        meta: TMeta;
        deckKey: keyof TMeta & string;
        discardKey: keyof TMeta & string;
        rngKey?: keyof TMeta & string;
    }): {
        meta: TMeta;
        card: TCard | null;
        reshuffled: boolean;
    };
}
export {};
