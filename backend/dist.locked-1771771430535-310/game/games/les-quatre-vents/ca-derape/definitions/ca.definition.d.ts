import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type CaDerapeGameId = 'ca-derape';
export type CaDerapePhaseId = 'turn';
export type CaDerapeActionType = 'roll' | 'ROLL_DICE' | 'choose_target' | 'choose_next_delta' | 'choose_next_player' | 'draw';
export declare const CA_DERAPE_GAME: GameDefinition<CaDerapeGameId, never, CaDerapeActionType, CaDerapePhaseId, null>;
