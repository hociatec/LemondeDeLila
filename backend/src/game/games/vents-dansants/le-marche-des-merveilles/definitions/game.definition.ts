import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type LeMarcheDesMerveillesActionType =
  | 'buy'
  | 'sell'
  | 'rumor'
  | 'protect'
  | 'steal_deal'
  | 'pass';

export type LeMarcheDesMerveillesPhaseId = 'market';

export const LE_MARCHE_DES_MERVEILLES_GAME: GameDefinition<
  'le-marche-des-merveilles',
  never,
  LeMarcheDesMerveillesActionType,
  LeMarcheDesMerveillesPhaseId,
  null
> = {
  id: 'le-marche-des-merveilles',
  displayName: 'Le Marche des Merveilles',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['buy', 'sell', 'rumor', 'protect', 'steal_deal', 'pass'],
  phaseOrder: [{ id: 'market', kind: 'player-action' }],
  victory: null,
} as const;
