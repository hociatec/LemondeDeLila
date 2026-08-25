import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type DameNatureActionType = 'ask_card' | 'pass';
export type DameNaturePhaseId = 'round';

export const DAME_NATURE_GAME: GameDefinition<
  'dame-nature',
  never,
  DameNatureActionType,
  DameNaturePhaseId,
  null
> = {
  id: 'dame-nature',
  displayName: 'Dame Nature',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['ask_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
