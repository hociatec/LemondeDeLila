import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type CatPattesGameId = 'cat-pattes';
export type CatPattesPhaseId = 'turn';
export type CatPattesActionType = 'play_card' | 'pass';

export const CAT_PATTES_GAME: GameDefinition<
  CatPattesGameId,
  never,
  CatPattesActionType,
  CatPattesPhaseId,
  null
> = {
  id: 'cat-pattes',
  displayName: 'Cat Pattes !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['play_card', 'pass'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
