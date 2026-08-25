import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type ZigEtZagGameId = 'zig-et-zag';
export type ZigEtZagPhaseId = 'turn';
export type ZigEtZagActionType = 'select_card' | 'draw_card';

export const ZIG_ET_ZAG_GAME: GameDefinition<
  ZigEtZagGameId,
  never,
  ZigEtZagActionType,
  ZigEtZagPhaseId,
  null
> = {
  id: 'zig-et-zag',
  displayName: 'Zig et Zag !',
  minPlayers: 2,
  maxPlayers: 2,
  roles: [],
  actions: ['draw_card', 'select_card'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
