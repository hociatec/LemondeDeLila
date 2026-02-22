import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type FrousseGameId = 'frousse-party';
export type FroussePhaseId = 'turn';
export type FrousseActionType = 'roll' | 'ROLL_DICE' | 'choose_target' | 'draw' | 'choose_pawn';
export declare const FROUSSE_GAME: GameDefinition<FrousseGameId, never, FrousseActionType, FroussePhaseId, null>;
