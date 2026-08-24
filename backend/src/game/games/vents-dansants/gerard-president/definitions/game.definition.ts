import type { GameDefinition } from '../../../../application/models/game-definition.model';

export type GerardPresidentActionType =
  | 'set_theme'
  | 'play_name'
  | 'play_special'
  | 'choose_winner'
  | 'pass';

export type GerardPresidentPhaseId = 'round';

declare global {
  type GerardPresidentGameId = 'gerard-president';
}

export const GERARD_PRESIDENT_GAME: GameDefinition<
  GerardPresidentGameId,
  never,
  GerardPresidentActionType,
  GerardPresidentPhaseId,
  null
> = {
  id: 'gerard-president',
  displayName: 'Gérard président !',
  minPlayers: 3,
  maxPlayers: 10,
  roles: [],
  actions: ['set_theme', 'play_name', 'play_special', 'choose_winner', 'pass'],
  phaseOrder: [{ id: 'round', kind: 'player-action' }],
  victory: null,
} as const;
