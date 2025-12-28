import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type OdysseeGameId = 'odyssee-quatre-cieux';
export type OdysseePhaseId = 'turn';
export type OdysseeActionType = 'roll' | 'ROLL_DICE' | 'move_pawn';

export const ODYSSEE_GAME: GameDefinition<
  OdysseeGameId,
  never,
  OdysseeActionType,
  OdysseePhaseId,
  null
> = {
  id: 'odyssee-quatre-cieux',
  displayName: "L'Odyssée des Quatre Cieux",
  minPlayers: 2,
  maxPlayers: 4,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'move_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
