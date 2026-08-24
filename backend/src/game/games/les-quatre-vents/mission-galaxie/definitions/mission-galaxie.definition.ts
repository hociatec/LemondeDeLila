import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type MissionGalaxieGameId = 'mission-galaxie';
export type MissionGalaxiePhaseId = 'turn';
export type MissionGalaxieActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'draw'
  | 'choose_option'
  | 'choose_event_move';

export const MISSION_GALAXIE_GAME: GameDefinition<
  MissionGalaxieGameId,
  never,
  MissionGalaxieActionType,
  MissionGalaxiePhaseId,
  null
> = {
  id: 'mission-galaxie',
  displayName: 'Mission Galaxie',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'draw', 'choose_option', 'choose_event_move'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
