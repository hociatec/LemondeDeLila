import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type PimpMyRideActionType = 'play_card' | 'discard_card' | 'pass';
export type PimpMyRidePhaseId = 'round';

export const PIMP_MY_RIDE_GAME: GameDefinition<
  'pimp-my-ride',
  never,
  PimpMyRideActionType,
  PimpMyRidePhaseId,
  null
> = {
  id: 'pimp-my-ride',
  displayName: 'Pimp My Ride',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['play_card', 'discard_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
