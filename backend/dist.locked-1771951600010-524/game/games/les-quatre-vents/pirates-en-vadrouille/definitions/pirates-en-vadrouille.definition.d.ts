import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type PiratesEnVadrouilleGameId = 'pirates-en-vadrouille';
export type PiratesEnVadrouillePhaseId = 'turn';
export type PiratesEnVadrouilleActionType = 'roll' | 'ROLL_DICE' | 'choose_target';
export declare const PIRATES_GAME: GameDefinition<PiratesEnVadrouilleGameId, never, PiratesEnVadrouilleActionType, PiratesEnVadrouillePhaseId, null>;
