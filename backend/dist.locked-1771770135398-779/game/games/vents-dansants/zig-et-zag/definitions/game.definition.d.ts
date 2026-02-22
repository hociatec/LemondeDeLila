import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type ZigEtZagGameId = 'zig-et-zag';
export type ZigEtZagPhaseId = 'turn';
export type ZigEtZagActionType = 'select_card' | 'draw_card';
export declare const ZIG_ET_ZAG_GAME: GameDefinition<ZigEtZagGameId, never, ZigEtZagActionType, ZigEtZagPhaseId, null>;
