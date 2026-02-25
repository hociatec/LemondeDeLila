import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type MonVillageGameId = 'mon-village-mon-histoire';
export type MonVillagePhaseId = 'turn';
export type MonVillageActionType = 'roll' | 'ROLL_DICE';
export declare const MON_VILLAGE_GAME: GameDefinition<MonVillageGameId, never, MonVillageActionType, MonVillagePhaseId, null>;
