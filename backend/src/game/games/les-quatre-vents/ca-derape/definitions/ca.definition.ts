import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type CaDerapeGameId = 'ca-derape';
export type CaDerapePhaseId = 'turn';
export type CaDerapeActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_target'
  | 'choose_next_delta'
  | 'choose_next_player'
  | 'draw';

export const CA_DERAPE_GAME: GameDefinition<
  CaDerapeGameId,
  never,
  CaDerapeActionType,
  CaDerapePhaseId,
  null
> = {
  id: 'ca-derape',
  displayName: 'Ça Dérape !',
  minPlayers: 2,
  maxPlayers: 10,
  roles: [],
  actions: [
    'roll',
    'ROLL_DICE',
    'choose_target',
    'choose_next_delta',
    'choose_next_player',
    'draw',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
