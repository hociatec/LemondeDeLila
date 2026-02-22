import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type OdysseeGameId = 'odyssee-quatre-cieux';
export type OdysseePhaseId = 'turn';
export type OdysseeActionType = 'roll' | 'ROLL_DICE' | 'move_pawn';
export declare const ODYSSEE_GAME: GameDefinition<OdysseeGameId, never, OdysseeActionType, OdysseePhaseId, null>;
