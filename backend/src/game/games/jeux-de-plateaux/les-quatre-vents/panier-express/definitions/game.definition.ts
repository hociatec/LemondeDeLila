import type { GameDefinition } from '../../../../../engine/model/game-definition.model';
import { PANIER_EXPRESS_VICTORY } from './victory.definition';

export type PanierExpressGameId = 'panier-express';

export type PanierExpressPhaseId = 'turn' | 'check_victory';

export type PanierExpressActionType =
  | 'roll'
  | 'ROLL_DICE'
  | 'answer_quiz'
  | 'exchange_with'
  | 'exchange_accept'
  | 'exchange_refuse'
  | 'skip_turn';

export const PANIER_EXPRESS_GAME: GameDefinition<
  PanierExpressGameId,
  never,
  PanierExpressActionType,
  PanierExpressPhaseId,
  typeof PANIER_EXPRESS_VICTORY
> = {
  id: 'panier-express',
  displayName: 'Panier Express',
  minPlayers: 2,
  maxPlayers: 10,
  roles: [],
  actions: ['roll', 'ROLL_DICE', 'answer_quiz', 'exchange_with', 'exchange_accept', 'exchange_refuse', 'skip_turn'],
  phaseOrder: [
    { id: 'turn', kind: 'player-action' },
    { id: 'check_victory', kind: 'system' },
  ],
  victory: PANIER_EXPRESS_VICTORY,
} as const;
