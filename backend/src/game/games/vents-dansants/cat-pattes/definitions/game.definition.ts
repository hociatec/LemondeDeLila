import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type CatPattesGameId = 'cat-pattes';
export type CatPattesPhaseId = 'turn';
export type CatPattesActionType =
  | 'draw'
  | 'play_card'
  | 'discard_card'
  | 'pass'
  | 'cat_pattes_set_config';

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
  actions: [
    'draw',
    'play_card',
    'discard_card',
    'pass',
    'cat_pattes_set_config',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
