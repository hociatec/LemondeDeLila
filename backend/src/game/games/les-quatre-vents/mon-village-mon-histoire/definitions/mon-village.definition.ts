import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type MonVillageGameId = 'mon-village-mon-histoire';
export type MonVillagePhaseId = 'turn';
export type MonVillageActionType = 'roll' | 'ROLL_DICE';

export const MON_VILLAGE_GAME: GameDefinition<
  MonVillageGameId,
  never,
  MonVillageActionType,
  MonVillagePhaseId,
  null
> = {
  id: 'mon-village-mon-histoire',
  displayName: 'Mon Village, Mon Histoire',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
