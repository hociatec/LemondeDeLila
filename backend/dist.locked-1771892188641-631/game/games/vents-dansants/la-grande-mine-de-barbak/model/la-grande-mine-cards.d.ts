export type LaGrandeMineCategory = 'tresor' | 'objet' | 'event' | 'monster' | 'collapse';
export interface LaGrandeMineCard {
    id: string;
    name: string;
    category: LaGrandeMineCategory;
    description: string;
    points?: number | null;
}
export declare const LA_GRANDE_MINE_CARDS: LaGrandeMineCard[];
export declare const LA_GRANDE_MINE_CARD_BY_ID: {
    [k: string]: LaGrandeMineCard;
};
