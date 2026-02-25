export type CerclesSacresTheme = 'totem' | 'nature' | 'plante' | 'esprit' | 'parole' | 'nation';
export interface CerclesSacresCardDefinition {
    id: string;
    name: string;
    theme: CerclesSacresTheme;
}
export declare const CERCLES_SACRES_DECK: CerclesSacresCardDefinition[];
export declare const CERCLES_SACRES_CARD_BY_ID: {
    [k: string]: CerclesSacresCardDefinition;
};
