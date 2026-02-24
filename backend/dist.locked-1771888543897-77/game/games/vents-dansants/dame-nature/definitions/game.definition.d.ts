import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type DameNatureActionType = 'ask_card' | 'pass';
export type DameNaturePhaseId = 'round';
export declare const DAME_NATURE_GAME: GameDefinition<'dame-nature', never, DameNatureActionType, DameNaturePhaseId, null>;
