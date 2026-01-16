import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { PETIT_CHEVAUX_VICTORY } from './victory.definition';

export type PetitChevauxGameId = 'foulees-fantastiques';
export type PetitChevauxPhaseId = 'turn';
export type PetitChevauxActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'roll_dice'
  | 'choose_family'
  | 'move_pawn';

export const FOULEES_FANTASTIQUES_GAME: GameDefinition<
  PetitChevauxGameId,
  never,
  PetitChevauxActionType,
  PetitChevauxPhaseId,
  typeof PETIT_CHEVAUX_VICTORY
> = {
  id: 'foulees-fantastiques',
  displayName: 'Foulées Fantastiques !',
  minPlayers: 2,
  maxPlayers: 4,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'roll_dice', 'choose_family', 'move_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: PETIT_CHEVAUX_VICTORY,
} as const;

// Alias de nom interne (legacy).
export const PETIT_CHEVAUX_GAME = FOULEES_FANTASTIQUES_GAME;
