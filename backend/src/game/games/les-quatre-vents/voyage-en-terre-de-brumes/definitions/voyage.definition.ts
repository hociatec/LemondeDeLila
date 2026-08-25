import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type VoyageGameId = 'voyage-en-terre-de-brumes';
export type VoyagePhaseId = 'turn';
export type VoyageActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'roll_dice'
  | 'draw'
  | 'answer_quiz'
  | 'choose_target';

export const VOYAGE_GAME: GameDefinition<
  VoyageGameId,
  never,
  VoyageActionType,
  VoyagePhaseId,
  null
> = {
  id: 'voyage-en-terre-de-brumes',
  displayName: 'Voyage En Terre De Brumes !',
  minPlayers: 2,
  maxPlayers: 10,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'draw', 'answer_quiz', 'choose_target'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
