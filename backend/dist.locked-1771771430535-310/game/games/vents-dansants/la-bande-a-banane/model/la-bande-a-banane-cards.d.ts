export type BandeABananeCardType = 'monkey' | 'action' | 'trap' | 'joker';
export type BandeABananeMonkeySpecies = 'capucin' | 'mandrill' | 'gibbon' | 'babouin' | 'macaque';
export type BandeABananeActionType = 'vol-de-banane' | 'cris-de-la-jungle' | 'grimpeur-fou';
export type BandeABananeTrapType = 'piege-a-noix-de-coco' | 'tigre-rodeur';
export interface BandeABananeCardDefinition {
    id: string;
    name: string;
    type: BandeABananeCardType;
    species?: BandeABananeMonkeySpecies;
    action?: BandeABananeActionType;
    trap?: BandeABananeTrapType;
}
export declare const BANDE_A_BANANE_DECK: BandeABananeCardDefinition[];
export declare const BANDE_A_BANANE_CARD_BY_ID: Record<string, BandeABananeCardDefinition>;
