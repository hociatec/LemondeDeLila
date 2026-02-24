export interface DameNatureFamilyCardDefinition {
    id: string;
    familyId: string;
    familyName: string;
    memberName: string;
    type: 'family';
}
export interface DameNatureQuizCardDefinition {
    id: string;
    question: string;
    options: string[];
    answer: string;
    type: 'quiz';
}
export interface DameNatureNatureCardDefinition {
    id: string;
    description: string;
    delta: number;
    type: 'nature';
}
export declare const DAME_NATURE_FAMILY_CARD_DEFINITIONS: DameNatureFamilyCardDefinition[];
export declare const DAME_NATURE_QUIZ_CARDS: DameNatureQuizCardDefinition[];
export declare const DAME_NATURE_NATURE_CARDS: DameNatureNatureCardDefinition[];
export declare const DAME_NATURE_CARD_BY_ID: {
    [x: string]: DameNatureFamilyCardDefinition | DameNatureQuizCardDefinition | DameNatureNatureCardDefinition;
};
export declare const DAME_NATURE_FAMILY_CARD_IDS: string[];
export declare const DAME_NATURE_QUIZ_CARD_IDS: string[];
export declare const DAME_NATURE_NATURE_CARD_IDS: string[];
