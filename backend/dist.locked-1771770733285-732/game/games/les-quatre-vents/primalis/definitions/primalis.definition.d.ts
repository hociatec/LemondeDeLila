import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type PrimalisGameId = 'primalis';
export type PrimalisPhaseId = 'turn';
export type PrimalisActionType = 'roll' | 'ROLL_DICE';
export declare const PRIMALIS_GAME: GameDefinition<PrimalisGameId, never, PrimalisActionType, PrimalisPhaseId, null>;
