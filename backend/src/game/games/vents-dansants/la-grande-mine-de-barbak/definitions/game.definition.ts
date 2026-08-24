import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type LaGrandeMineActionType = 'play_card' | 'pass';
export type LaGrandeMinePhaseId = 'round';

export const LA_GRANDE_MINE_GAME: GameDefinition<
  'la-grande-mine-de-barbak',
  never,
  LaGrandeMineActionType,
  LaGrandeMinePhaseId,
  null
> = {
  id: 'la-grande-mine-de-barbak',
  displayName: 'La Grande Mine de Barbak !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['play_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
