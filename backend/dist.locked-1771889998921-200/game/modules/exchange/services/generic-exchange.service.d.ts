export type ExchangeOffer<TItem = any> = {
    give: TItem;
    take: TItem;
};
export declare class GenericExchangeService {
    buildActions<TItem>(state: {
        players: any[];
    }, playerId: number, inventoryKey?: string): ExchangeOffer<TItem>[];
}
