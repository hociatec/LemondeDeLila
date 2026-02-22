import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type VoyageGameId = 'voyage-en-terre-de-brumes';
export type VoyagePhaseId = 'turn';
export type VoyageActionType = 'roll' | 'ROLL_DICE' | 'roll_dice' | 'draw' | 'answer_quiz' | 'choose_target';
export declare const VOYAGE_GAME: GameDefinition<VoyageGameId, never, VoyageActionType, VoyagePhaseId, null>;
