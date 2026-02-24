export type CatPattesCardType = 'pattes' | 'obstacle' | 'parade' | 'bot';
export type CatPattesObstacleType = 'gamelle' | 'pluie' | 'chien' | 'coussin' | 'sol';
export type CatPattesParadeType = 'croquettes' | 'rayon' | 'dodo' | 'coussin' | 'saut';
export type CatPattesBotType = 'reserve' | 'chat-ninja' | 'patte-blindee' | 'passage-star';
export type CatPattesPawn = 'Maine Coon' | 'Siamois' | 'Persan' | 'Bengal' | 'Chartreux' | 'Angora';
export interface CatPattesCardDefinition {
    id: string;
    name: string;
    type: CatPattesCardType;
    value?: number;
    obstacle?: CatPattesObstacleType;
    parade?: CatPattesParadeType;
    bot?: CatPattesBotType;
}
export declare const CAT_PATTES_DECK: CatPattesCardDefinition[];
export declare const CAT_PATTES_CARD_BY_ID: Record<string, CatPattesCardDefinition>;
export declare const CAT_PATTES_PAWNS: CatPattesPawn[];
