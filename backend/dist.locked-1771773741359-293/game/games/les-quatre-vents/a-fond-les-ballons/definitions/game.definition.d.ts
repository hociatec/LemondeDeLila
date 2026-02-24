import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type AFondLesBallonsGameId = 'a-fond-les-ballons';
export type AFondLesBallonsPhaseId = 'turn';
export type AFondLesBallonsActionType = 'choose_pawn' | 'roll' | 'ROLL_DICE' | 'swap_choose_target' | 'draw';
export declare const A_FOND_LES_BALLONS_GAME: GameDefinition<AFondLesBallonsGameId, never, AFondLesBallonsActionType, AFondLesBallonsPhaseId, null>;
