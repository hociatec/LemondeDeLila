import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type OlympiaActionType = 'draw_card' | 'play_card' | 'pass';
export type OlympiaPhaseId = 'round';
export type OlympiaGameId = 'olympia';
export declare const OLYMPIA_GAME: GameDefinition<OlympiaGameId, never, OlympiaActionType, OlympiaPhaseId, null>;
