import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type LaParadeSucreeActionType = 'play_card' | 'pass';
export type LaParadeSucreePhaseId = 'round';
export declare const LA_PARADE_SUCREE_GAME: GameDefinition<'la-parade-sucree', never, LaParadeSucreeActionType, LaParadeSucreePhaseId, null>;
