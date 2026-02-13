import type { GameDefinition } from '../../../../engine/model/game-definition.model';

export type JeuOieGameId = 'jeu-oie';
export type JeuOiePhaseId = 'turn';
export type JeuOieActionType = 'roll' | 'ROLL_DICE' | 'choose_pawn';

export const JEU_OIE_GAME: GameDefinition<
  JeuOieGameId,
  never,
  JeuOieActionType,
  JeuOiePhaseId,
  null
> = {
  id: 'jeu-oie',
  displayName: "Jeu de l'oie",
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'choose_pawn'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
