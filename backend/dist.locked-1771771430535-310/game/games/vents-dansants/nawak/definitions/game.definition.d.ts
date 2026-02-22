import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type NawakGameId = 'nawak';
export type NawakPhaseId = 'turn';
export type NawakActionType = 'choose_answer' | 'vote_answer';
export declare const NAWAK_GAME: GameDefinition<NawakGameId, never, NawakActionType, NawakPhaseId, null>;
