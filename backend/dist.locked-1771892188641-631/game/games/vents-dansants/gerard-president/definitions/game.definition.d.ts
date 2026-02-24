import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type GerardPresidentActionType = 'set_theme' | 'play_name' | 'play_special' | 'choose_winner' | 'pass';
export type GerardPresidentPhaseId = 'round';
declare global {
    type GerardPresidentGameId = 'gerard-president';
}
export declare const GERARD_PRESIDENT_GAME: GameDefinition<GerardPresidentGameId, never, GerardPresidentActionType, GerardPresidentPhaseId, null>;
