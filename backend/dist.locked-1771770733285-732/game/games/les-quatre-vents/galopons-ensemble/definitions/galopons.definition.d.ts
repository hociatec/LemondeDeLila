import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type GaloponsGameId = 'galopons-ensemble';
export type GaloponsPhaseId = 'turn';
export type GaloponsActionType = 'roll' | 'ROLL_DICE' | 'choose_target' | 'draw';
export declare const GALOPONS_GAME: GameDefinition<GaloponsGameId, never, GaloponsActionType, GaloponsPhaseId, null>;
