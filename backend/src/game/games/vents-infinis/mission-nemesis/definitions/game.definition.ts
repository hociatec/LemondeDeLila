import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { MISSION_NEMESIS_VICTORY } from './victory.definition';

export type MissionNemesisGameId = 'mission-nemesis';
export type MissionNemesisPhaseId = 'turn';
export type MissionNemesisActionType = never;

export const MISSION_NEMESIS_GAME: GameDefinition<
  MissionNemesisGameId,
  never,
  MissionNemesisActionType,
  MissionNemesisPhaseId,
  typeof MISSION_NEMESIS_VICTORY
> = {
  id: 'mission-nemesis',
  displayName: 'Mission Nemesis',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: [],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: MISSION_NEMESIS_VICTORY,
} as const;
