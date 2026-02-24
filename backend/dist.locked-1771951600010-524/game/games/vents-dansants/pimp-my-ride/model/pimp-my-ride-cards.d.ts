export type PimpMyRideCategory = 'carrosserie' | 'roues' | 'moteur' | 'volant' | 'sieges' | 'phares' | 'accessoires';
export interface PimpMyRideCardDefinition {
    id: string;
    name: string;
    category: PimpMyRideCategory;
}
export interface PimpMyRideCarName {
    name: string;
    description: string;
}
export declare const PIMP_MY_RIDE_CATEGORY_ORDER: PimpMyRideCategory[];
export declare const PIMP_MY_RIDE_DECK: PimpMyRideCardDefinition[];
export declare const PIMP_MY_RIDE_CARD_BY_ID: {
    [k: string]: PimpMyRideCardDefinition;
};
export declare const PIMP_MY_RIDE_CAR_NAMES: PimpMyRideCarName[];
