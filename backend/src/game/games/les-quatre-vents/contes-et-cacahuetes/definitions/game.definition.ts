import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type ContesCacahuetesGameId = 'contes-et-cacahuetes';
export type ContesCacahuetesPhaseId = 'turn';
export type ContesCacahuetesActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'choose_pawn'
  | 'reroll_yes'
  | 'reroll_no'
  | 'choose_target'
  | 'choose_number'
  | 'choose_option'
  | 'choose_card'
  | 'draw';

export const CONTES_CACAHUETES_GAME: GameDefinition<
  ContesCacahuetesGameId,
  never,
  ContesCacahuetesActionType,
  ContesCacahuetesPhaseId,
  null
> = {
  id: 'contes-et-cacahuetes',
  displayName: 'Contes et cacahuètes !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: [
    'roll',
    'ROLL_DICE',
    'choose_pawn',
    'reroll_yes',
    'reroll_no',
    'choose_target',
    'choose_number',
    'choose_option',
    'choose_card',
    'draw',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;

