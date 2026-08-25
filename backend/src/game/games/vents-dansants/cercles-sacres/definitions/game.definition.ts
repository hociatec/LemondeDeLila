import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type CerclesSacresGameId = 'cercles-sacres';
export type CerclesSacresPhaseId = 'turn';
export type CerclesSacresActionType = 'form_circle' | 'discard_card' | 'pass';

export const CERCLES_SACRES_GAME: GameDefinition<
  CerclesSacresGameId,
  never,
  CerclesSacresActionType,
  CerclesSacresPhaseId,
  null
> = {
  id: 'cercles-sacres',
  displayName: 'Cercles Sacrés',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['form_circle', 'discard_card', 'pass'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
