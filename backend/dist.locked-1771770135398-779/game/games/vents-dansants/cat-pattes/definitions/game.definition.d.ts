import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type CatPattesGameId = 'cat-pattes';
export type CatPattesPhaseId = 'turn';
export type CatPattesActionType = 'draw' | 'play_card' | 'discard_card' | 'pass' | 'choose_pawn';
export declare const CAT_PATTES_GAME: GameDefinition<CatPattesGameId, never, CatPattesActionType, CatPattesPhaseId, null>;
