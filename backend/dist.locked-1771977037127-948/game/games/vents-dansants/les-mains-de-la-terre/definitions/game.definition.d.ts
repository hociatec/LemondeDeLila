import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type LesMainsGameId = 'les-mains-de-la-terre';
export type LesMainsPhaseId = 'turn';
export type LesMainsActionType = 'request_card';
export declare const LES_MAINS_GAME: GameDefinition<LesMainsGameId, never, LesMainsActionType, LesMainsPhaseId, null>;
