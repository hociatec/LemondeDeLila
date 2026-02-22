import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type EntreRitesGameId = 'entre-rites-et-lumieres';
export type EntreRitesPhaseId = 'turn';
export type EntreRitesActionType = 'ask_card' | 'pass';
export declare const ENTRE_RITES_GAME: GameDefinition<EntreRitesGameId, never, EntreRitesActionType, EntreRitesPhaseId, null>;
