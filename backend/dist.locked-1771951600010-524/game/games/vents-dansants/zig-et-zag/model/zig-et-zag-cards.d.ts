export type ZigEtZagColor = 'vert-sauge' | 'bleu-ardoise';
export type ZigEtZagFamily = 'banane' | 'dentifrice' | 'pantoufle' | 'bougie';
export type ZigEtZagCardType = 'simple' | 'figure' | 'joker';
export interface ZigEtZagCardDefinition {
    id: string;
    name: string;
    type: ZigEtZagCardType;
    color: ZigEtZagColor;
    family?: ZigEtZagFamily;
    value: number;
    allowedFamilies?: ZigEtZagFamily[];
}
export declare const ZIG_ET_ZAG_DECK: ZigEtZagCardDefinition[];
export declare const ZIG_ET_ZAG_TOTAL_CARDS: number;
export declare const ZIG_ET_ZAG_CARD_BY_ID: Record<string, ZigEtZagCardDefinition>;
