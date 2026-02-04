import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type AbsurdissimesGameId = 'les-absurdissimes';
export type AbsurdissimesPhaseId = 'turn';
export type AbsurdissimesActionType = 'play_card' | 'judge_pick';

export const ABSURDISSIMES_GAME: GameDefinition<
  AbsurdissimesGameId,
  never,
  AbsurdissimesActionType,
  AbsurdissimesPhaseId,
  null
> = {
  id: 'les-absurdissimes',
  displayName: 'Les Absurdissimes !',
  minPlayers: 3,
  maxPlayers: 8,
  roles: [],
  actions: ['play_card', 'judge_pick'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
