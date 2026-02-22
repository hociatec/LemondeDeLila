import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type ContesCacahuetesGameId = 'contes-et-cacahuetes';
export type ContesCacahuetesPhaseId = 'turn';
export type ContesCacahuetesActionType = 'roll' | 'ROLL_DICE' | 'choose_pawn' | 'reroll_yes' | 'reroll_no' | 'choose_target' | 'choose_number' | 'choose_option' | 'choose_card' | 'draw';
export declare const CONTES_CACAHUETES_GAME: GameDefinition<ContesCacahuetesGameId, never, ContesCacahuetesActionType, ContesCacahuetesPhaseId, null>;
