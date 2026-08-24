import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type AFondLesBallonsGameId = 'a-fond-les-ballons';
export type AFondLesBallonsPhaseId = 'turn';
export type AFondLesBallonsActionType =
  | 'choose_pawn'
  | 'roll'
  | 'ROLL_DICE'
  | 'swap_choose_target'
  | 'draw';

export const A_FOND_LES_BALLONS_GAME: GameDefinition<
  AFondLesBallonsGameId,
  never,
  AFondLesBallonsActionType,
  AFondLesBallonsPhaseId,
  null
> = {
  id: 'a-fond-les-ballons',
  displayName: 'A fond les ballons !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['choose_pawn', 'roll', 'ROLL_DICE', 'swap_choose_target', 'draw'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
