import type { GameDefinition } from '../../../../core/application/models/game-definition.model';

export type SacAMalicesGameId = 'sac-a-malices';
export type SacAMalicesPhaseId = 'turn';
export type SacAMalicesActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'roll_dice'
  | 'buy'
  | 'skip_buy'
  | 'build'
  | 'sell_building'
  | 'mortgage'
  | 'unmortgage'
  | 'choose_property'
  | 'pay_fine'
  | 'use_jail_card'
  | 'sac_set_variant';

export const SAC_A_MALICES_GAME: GameDefinition<
  SacAMalicesGameId,
  never,
  SacAMalicesActionType,
  SacAMalicesPhaseId,
  null
> = {
  id: 'sac-a-malices',
  displayName: 'Sac à Malices!',
  minPlayers: 2,
  maxPlayers: 8,
  roles: [],
  actions: [
    'roll',
    'ROLL_DICE',
    'buy',
    'skip_buy',
    'build',
    'sell_building',
    'mortgage',
    'unmortgage',
    'choose_property',
    'pay_fine',
    'use_jail_card',
    'sac_set_variant',
  ],
  phaseOrder: [{ id: 'turn', kind: 'player-action' }],
  victory: null,
} as const;

