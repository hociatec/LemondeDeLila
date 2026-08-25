import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type EntreRitesGameId = 'entre-rites-et-lumieres';
export type EntreRitesPhaseId = 'turn';
export type EntreRitesActionType = 'ask_card' | 'pass';

export const ENTRE_RITES_GAME: GameDefinition<
  EntreRitesGameId,
  never,
  EntreRitesActionType,
  EntreRitesPhaseId,
  null
> = {
  id: 'entre-rites-et-lumieres',
  displayName: 'Entre Rites & Lumières !',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['ask_card', 'pass'],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;
