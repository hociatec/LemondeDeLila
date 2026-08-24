import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type LaParadeSucreeActionType = 'play_card' | 'pass';
export type LaParadeSucreePhaseId = 'round';

export const LA_PARADE_SUCREE_GAME: GameDefinition<
  'la-parade-sucree',
  never,
  LaParadeSucreeActionType,
  LaParadeSucreePhaseId,
  null
> = {
  id: 'la-parade-sucree',
  displayName: 'La Parade Sucrée !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['play_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
