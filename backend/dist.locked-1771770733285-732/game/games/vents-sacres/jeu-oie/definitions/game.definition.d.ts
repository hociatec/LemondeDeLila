import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type JeuOieGameId = 'jeu-oie';
export type JeuOiePhaseId = 'turn';
export type JeuOieActionType = 'roll' | 'ROLL_DICE' | 'choose_pawn';
export declare const JEU_OIE_GAME: GameDefinition<JeuOieGameId, never, JeuOieActionType, JeuOiePhaseId, null>;
