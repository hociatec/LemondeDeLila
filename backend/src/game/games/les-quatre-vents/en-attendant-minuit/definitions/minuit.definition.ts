import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type MinuitGameId = 'en-attendant-minuit';
export type MinuitPhaseId = 'turn';
export type MinuitActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_target'
  | 'answer_quiz';

export const MINUIT_GAME: GameDefinition<
  MinuitGameId,
  never,
  MinuitActionType,
  MinuitPhaseId,
  null
> = {
  id: 'en-attendant-minuit',
  displayName: 'En Attendant Minuit !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'choose_target', 'answer_quiz'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
