import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type TaxiExpressGameId = 'taxi-express';
export type TaxiExpressPhaseId = 'turn';
export type TaxiExpressActionType = 'roll';

export const TAXI_EXPRESS_GAME: GameDefinition<
  TaxiExpressGameId,
  never,
  TaxiExpressActionType,
  TaxiExpressPhaseId,
  null
> = {
  id: 'taxi-express',
  displayName: 'Taxi Express',
  minPlayers: 2,
  maxPlayers: 5,
  roles: [],
  actions: ['roll'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
