import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type LaGrandeMineActionType = 'play_card' | 'pass';
export type LaGrandeMinePhaseId = 'round';
export declare const LA_GRANDE_MINE_GAME: GameDefinition<'la-grande-mine-de-barbak', never, LaGrandeMineActionType, LaGrandeMinePhaseId, null>;
