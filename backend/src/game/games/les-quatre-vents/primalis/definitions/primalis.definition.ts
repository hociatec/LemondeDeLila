import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type PrimalisGameId = 'primalis';
export type PrimalisPhaseId = 'turn';
export type PrimalisActionType = 'roll' | 'ROLL_DICE';

export const PRIMALIS_GAME: GameDefinition<
  PrimalisGameId,
  never,
  PrimalisActionType,
  PrimalisPhaseId,
  null
> = {
  id: 'primalis',
  displayName: 'Primalis',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;

