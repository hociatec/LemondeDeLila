import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type FrousseGameId = 'frousse-party';
export type FroussePhaseId = 'turn';
export type FrousseActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_target'
  | 'swap_decline'
  | 'draw'
  | 'choose_pawn';

export const FROUSSE_GAME: GameDefinition<
  FrousseGameId,
  never,
  FrousseActionType,
  FroussePhaseId,
  null
> = {
  id: 'frousse-party',
  displayName: 'Frousse Party !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: [
    'roll',
    'ROLL_DICE',
    'choose_target',
    'swap_decline',
    'draw',
    'choose_pawn',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
