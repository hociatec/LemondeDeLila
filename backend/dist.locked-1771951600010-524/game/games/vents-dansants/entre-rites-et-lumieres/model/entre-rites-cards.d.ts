export type RiteFamilyId = 'symboles-sacres' | 'creatures-de-paques' | 'traditions-et-fetes' | 'gourmandises-objets' | 'nature-saisons';
export type RiteCardType = 'family' | 'special';
export interface RiteFamilyCard {
    id: string;
    type: 'family';
    name: string;
    familyId: RiteFamilyId;
    familyName: string;
}
export interface RiteSpecialCard {
    id: string;
    type: 'special';
    name: string;
    description: string;
    effect: string;
}
export type RiteCardDefinition = RiteFamilyCard | RiteSpecialCard;
export declare const ENTRE_RITES_FAMILY_CARDS: RiteFamilyCard[];
export declare const ENTRE_RITES_SPECIAL_CARDS: RiteSpecialCard[];
export declare const ENTRE_RITES_DECK: RiteCardDefinition[];
export declare const ENTRE_RITES_CUSTOM_FAMILY_SIZE: Record<RiteFamilyId, number>;
export declare const ENTRE_RITES_CARD_BY_ID: {
    [k: string]: RiteCardDefinition;
};
