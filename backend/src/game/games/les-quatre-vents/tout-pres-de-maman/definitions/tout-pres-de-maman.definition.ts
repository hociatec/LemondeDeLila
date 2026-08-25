import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type ToutPresDeMamanGameId = 'tout-pres-de-maman';
export type ToutPresDeMamanPhaseId = 'turn';
export type ToutPresDeMamanActionType = 'roll';

export const TOUT_PRES_DE_MAMAN_GAME: GameDefinition<
  ToutPresDeMamanGameId,
  never,
  ToutPresDeMamanActionType,
  ToutPresDeMamanPhaseId,
  null
> = {
  id: 'tout-pres-de-maman',
  displayName: 'Tout près de Maman !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['roll'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
