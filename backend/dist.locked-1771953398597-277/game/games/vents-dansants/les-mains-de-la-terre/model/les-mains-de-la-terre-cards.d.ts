export type LesMainsFamily = 'tradition' | 'nature' | 'mer' | 'art' | 'insolites' | 'innovation' | 'sante';
export type LesMainsCardType = 'metier' | 'special';
export interface LesMainsCardDefinition {
    id: string;
    name: string;
    type: LesMainsCardType;
    family?: LesMainsFamily;
}
export declare const LES_MAINS_METIER_CARDS: LesMainsCardDefinition[];
export declare const LES_MAINS_SPECIAL_CARDS: LesMainsCardDefinition[];
export declare const LES_MAINS_DECK: LesMainsCardDefinition[];
export declare const LES_MAINS_CARD_BY_ID: Record<string, LesMainsCardDefinition>;
export declare const LES_MAINS_FAMILY_SIZE = 6;
export declare const LES_MAINS_FAMILIES: LesMainsFamily[];
export declare const LES_MAINS_SPECIAL_CARD_IDS: Set<string>;
export declare const isLesMainsSpecialCard: (cardId: string) => boolean;
