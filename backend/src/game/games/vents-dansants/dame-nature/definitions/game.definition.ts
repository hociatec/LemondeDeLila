import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { DAME_NATURE_VICTORY } from './victory.definition';

export type DameNatureGameId = 'dame-nature';

export type DameNaturePhaseId = 'turn' | 'pollution-check';

export type DameNatureActionType =
  | 'draw'
  | 'discard_card'
  | 'ask_card'
  | 'answer_ask_card_accept'
  | 'answer_ask_card_refuse'
  | 'answer_quiz';

export const DAME_NATURE_GAME: GameDefinition<
  DameNatureGameId,
  never,
  DameNatureActionType,
  DameNaturePhaseId,
  typeof DAME_NATURE_VICTORY
> = {
  id: 'dame-nature',
  displayName: 'Dame Nature',
  minPlayers: 2,
  maxPlayers: 6,
  roles: [],
  actions: [
    'draw',
    'discard_card',
    'ask_card',
    'answer_ask_card_accept',
    'answer_ask_card_refuse',
    'answer_quiz',
  ],
  phaseOrder: [
    { id: 'turn', kind: 'player-action' },
    { id: 'pollution-check', kind: 'system' },
  ],
  victory: DAME_NATURE_VICTORY,
} as const;
