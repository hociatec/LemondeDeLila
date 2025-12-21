import { LOUP_GAROU_VICTORY } from './victory.definition';
import type { GarouRole, GarouStep } from '../model/loup-garou.types';
import type { GameDefinition } from '../../../../../engine/model/game-definition.model';

export type LoupGarouRoleDefinition = {
  id: GarouRole;
  name: string;
  unique: boolean;
};

export type LoupGarouActionType =
  | 'seer_peek'
  | 'cupid_link'
  | 'wolves_choose'
  | 'witch_decide'
  | 'day_vote';

export type LoupGarouPhaseDefinition = {
  id: GarouStep;
  kind: 'player-action' | 'system';
};

export const LOUP_GAROU_GAME = {
  id: 'loup-garou',
  displayName: 'Loup Garou',
  minPlayers: 6,
  maxPlayers: 12,
  roles: [
    { id: 'seer', name: 'Voyante', unique: true },
    { id: 'cupid', name: 'Cupidon', unique: true },
    { id: 'witch', name: 'Sorcière', unique: true },
    { id: 'werewolf', name: 'Loup', unique: false },
    { id: 'villager', name: 'Villageois', unique: false },
  ] satisfies LoupGarouRoleDefinition[],
  actions: [
    'seer_peek',
    'cupid_link',
    'wolves_choose',
    'witch_decide',
    'day_vote',
  ] satisfies LoupGarouActionType[],
  phaseOrder: [
    { id: 'seer', kind: 'player-action' },
    { id: 'cupid', kind: 'player-action' },
    { id: 'wolves', kind: 'player-action' },
    { id: 'witch', kind: 'player-action' },
    { id: 'resolve-night', kind: 'system' },
    { id: 'announce', kind: 'system' },
    { id: 'day-vote', kind: 'player-action' },
    { id: 'resolve-day', kind: 'system' },
    { id: 'check-victory', kind: 'system' },
  ] satisfies LoupGarouPhaseDefinition[],
  botPreferTypesByStep: {
    seer: ['seer_peek'],
    cupid: ['cupid_link'],
    wolves: ['wolves_choose'],
    witch: ['witch_decide'],
    'day-vote': ['day_vote'],
  } satisfies Record<
    Extract<GarouStep, 'seer' | 'cupid' | 'wolves' | 'witch' | 'day-vote'>,
    LoupGarouActionType[]
  >,
  victory: LOUP_GAROU_VICTORY,
  roleDistribution(playerCount: number): GarouRole[] {
    // Priority list used by RolesAssignmentService (randomized player order).
    // Wolves count scales with player count.
    const wolves = playerCount >= 8 ? 2 : 1;
    const prioritized: GarouRole[] = ['seer', 'witch', 'cupid'];
    for (let i = 0; i < wolves; i++) prioritized.push('werewolf');
    return prioritized;
  },
} as const;

// Compile-time shape check (no runtime cost).
export const _LOUP_GAROU_GAME_SHAPE: GameDefinition<
  'loup-garou',
  GarouRole,
  LoupGarouActionType,
  GarouStep,
  typeof LOUP_GAROU_VICTORY
> = LOUP_GAROU_GAME;
