import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type LesMainsGameId = 'les-mains-de-la-terre';
export type LesMainsPhaseId = 'turn';
export type LesMainsActionType = 'request_card';

export const LES_MAINS_GAME: GameDefinition<
  LesMainsGameId,
  never,
  LesMainsActionType,
  LesMainsPhaseId,
  null
> = {
  id: 'les-mains-de-la-terre',
  displayName: 'Les Mains de la Terre',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['request_card'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
