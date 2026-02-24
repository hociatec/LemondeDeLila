import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type AbsurdissimesGameId = 'les-absurdissimes';
export type AbsurdissimesPhaseId = 'turn';
export type AbsurdissimesActionType = 'play_card' | 'judge_pick';
export declare const ABSURDISSIMES_GAME: GameDefinition<AbsurdissimesGameId, never, AbsurdissimesActionType, AbsurdissimesPhaseId, null>;
