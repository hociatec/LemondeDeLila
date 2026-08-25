import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type OlympiaActionType = 'draw_card' | 'play_card' | 'pass';
export type OlympiaPhaseId = 'round';

export type OlympiaGameId = 'olympia';

export const OLYMPIA_GAME: GameDefinition<
  OlympiaGameId,
  never,
  OlympiaActionType,
  OlympiaPhaseId,
  null
> = {
  id: 'olympia',
  displayName: 'Olympia',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: ['draw_card', 'play_card', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
