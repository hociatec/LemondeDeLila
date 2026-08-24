import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type GaloponsGameId = 'galopons-ensemble';
export type GaloponsPhaseId = 'turn';
export type GaloponsActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_target'
  | 'draw'
  | 'choose_pawn';

export const GALOPONS_GAME: GameDefinition<
  GaloponsGameId,
  never,
  GaloponsActionType,
  GaloponsPhaseId,
  null
> = {
  id: 'galopons-ensemble',
  displayName: 'Galopons ensemble !',
  minPlayers: 2,
  maxPlayers: 4,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'choose_target', 'draw', 'choose_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
