import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type BandeABananeActionType = 'play_card' | 'pass';
export type BandeABananePhaseId = 'round';

export const BANDE_A_BANANE_GAME: GameDefinition<
  'la-bande-a-banane',
  never,
  BandeABananeActionType,
  BandeABananePhaseId,
  null
> = {
  id: 'la-bande-a-banane',
  displayName: 'La Bande à Banane !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['play_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
