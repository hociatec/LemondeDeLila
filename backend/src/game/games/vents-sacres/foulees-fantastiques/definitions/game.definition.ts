import type { GameDefinition } from '../../../../core/application/models/game-definition.model';
import { FOULEES_FANTASTIQUES_VICTORY } from './victory.definition';

export type FouleesFantastiquesGameId = 'foulees-fantastiques';
export type FouleesFantastiquesPhaseId = 'turn';
export type FouleesFantastiquesActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'roll_dice'
  | 'choose_family'
  | 'move_pawn';

export const FOULEES_FANTASTIQUES_GAME: GameDefinition<
  FouleesFantastiquesGameId,
  never,
  FouleesFantastiquesActionType,
  FouleesFantastiquesPhaseId,
  typeof FOULEES_FANTASTIQUES_VICTORY
> = {
  id: 'foulees-fantastiques',
  displayName: 'Foulées Fantastiques !',
  minPlayers: 2,
  maxPlayers: 4,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'roll_dice', 'choose_family', 'move_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: FOULEES_FANTASTIQUES_VICTORY,
} as const;
