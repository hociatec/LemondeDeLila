import type { GameDefinition } from '../../../../../engine/model/game-definition.model';
import { PETIT_CHEVAUX_VICTORY } from './victory.definition';

export type PetitChevauxGameId = 'petit-chevaux';
export type PetitChevauxPhaseId = 'turn';
export type PetitChevauxActionType = never;

export const PETIT_CHEVAUX_GAME: GameDefinition<
  PetitChevauxGameId,
  never,
  PetitChevauxActionType,
  PetitChevauxPhaseId,
  typeof PETIT_CHEVAUX_VICTORY
> = {
  id: 'petit-chevaux',
  displayName: 'petit chevaux',
  minPlayers: 2,
  maxPlayers: 10,
  roles: [],
  actions: [],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: PETIT_CHEVAUX_VICTORY,
} as const;
