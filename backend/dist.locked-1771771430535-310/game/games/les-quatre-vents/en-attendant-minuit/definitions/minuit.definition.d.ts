import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type MinuitGameId = 'en-attendant-minuit';
export type MinuitPhaseId = 'turn';
export type MinuitActionType = 'roll' | 'ROLL_DICE' | 'draw' | 'choose_target' | 'answer_quiz' | 'pick_pawn';
export declare const MINUIT_GAME: GameDefinition<MinuitGameId, never, MinuitActionType, MinuitPhaseId, null>;
