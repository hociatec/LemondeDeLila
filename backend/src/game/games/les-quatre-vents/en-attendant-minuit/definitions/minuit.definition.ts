import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type MinuitGameId = 'en-attendant-minuit';
export type MinuitPhaseId = 'turn';
export type MinuitActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'draw'
  | 'choose_target'
  | 'answer_quiz'
  | 'pick_pawn';

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
  actions: [
    'roll',
    'ROLL_DICE',
    'draw',
    'choose_target',
    'answer_quiz',
    'pick_pawn',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
