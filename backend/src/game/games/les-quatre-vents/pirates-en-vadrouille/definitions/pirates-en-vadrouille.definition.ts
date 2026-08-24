import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type PiratesEnVadrouilleGameId = 'pirates-en-vadrouille';
export type PiratesEnVadrouillePhaseId = 'turn';
export type PiratesEnVadrouilleActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_target';

export const PIRATES_GAME: GameDefinition<
  PiratesEnVadrouilleGameId,
  never,
  PiratesEnVadrouilleActionType,
  PiratesEnVadrouillePhaseId,
  null
> = {
  id: 'pirates-en-vadrouille',
  displayName: 'Pirates en vadrouille !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'choose_target'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;

