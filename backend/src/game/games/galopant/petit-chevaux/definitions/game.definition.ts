import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { PETIT_CHEVAUX_VICTORY } from './victory.definition';

export type PetitChevauxGameId = 'petit-chevaux';
export type PetitChevauxPhaseId = 'turn';
export type PetitChevauxActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'roll_dice'
  | 'move_pawn';

export const PETIT_CHEVAUX_GAME: GameDefinition<
  PetitChevauxGameId,
  never,
  PetitChevauxActionType,
  PetitChevauxPhaseId,
  typeof PETIT_CHEVAUX_VICTORY
> = {
  id: 'petit-chevaux',
  displayName: 'Petits chevaux',
  minPlayers: 2,
  maxPlayers: 4,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'roll_dice', 'move_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: PETIT_CHEVAUX_VICTORY,
} as const;
