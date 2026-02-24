import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type MissionGalaxieGameId = 'mission-galaxie';
export type MissionGalaxiePhaseId = 'turn';
export type MissionGalaxieActionType = 'roll' | 'ROLL_DICE' | 'draw' | 'choose_option' | 'choose_event_move';
export declare const MISSION_GALAXIE_GAME: GameDefinition<MissionGalaxieGameId, never, MissionGalaxieActionType, MissionGalaxiePhaseId, null>;
