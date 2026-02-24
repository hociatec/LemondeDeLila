import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type CerclesSacresGameId = 'cercles-sacres';
export type CerclesSacresPhaseId = 'turn';
export type CerclesSacresActionType = 'form_circle' | 'discard_card' | 'pass';
export declare const CERCLES_SACRES_GAME: GameDefinition<CerclesSacresGameId, never, CerclesSacresActionType, CerclesSacresPhaseId, null>;
