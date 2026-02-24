import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type BandeABananeActionType = 'play_card' | 'pass';
export type BandeABananePhaseId = 'round';
export declare const BANDE_A_BANANE_GAME: GameDefinition<'la-bande-a-banane', never, BandeABananeActionType, BandeABananePhaseId, null>;
