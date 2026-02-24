export type ParadeCandyType = 'Chamallow' | 'Chocobon' | 'Balisto';
export interface LaParadeSucreeCard {
    id: string;
    name: string;
    value: string;
    special: boolean;
}
export declare const LA_PARADE_SEQUENCE: readonly ["2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R", "A"];
export declare const LA_PARADE_CARD_DECK: LaParadeSucreeCard[];
export declare const LA_PARADE_CARD_BY_ID: {
    [k: string]: LaParadeSucreeCard;
};
export declare const LA_PARADE_SPECIAL_REWARDS: Record<string, Partial<Record<ParadeCandyType, number>>>;
export declare const CANDY_VALUES: Record<ParadeCandyType, number>;
export declare const INITIAL_CANDIES: Record<ParadeCandyType, number>;
