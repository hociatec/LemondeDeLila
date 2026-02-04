import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type NawakGameId = 'nawak';
export type NawakPhaseId = 'turn';
export type NawakActionType = 'choose_answer' | 'vote_answer';

export const NAWAK_GAME: GameDefinition<
  NawakGameId,
  never,
  NawakActionType,
  NawakPhaseId,
  null
> = {
  id: 'nawak',
  displayName: 'Nawak !',
  minPlayers: 2,
  maxPlayers: 8,
  roles: [],
  actions: ['choose_answer', 'vote_answer'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
