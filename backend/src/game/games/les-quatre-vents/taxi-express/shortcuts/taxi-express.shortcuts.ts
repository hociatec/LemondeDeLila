import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';

export const buildTaxiExpressShortcuts: GameShortcutsBuilder = () => [
  { key: 'roll', type: 'action', actionType: 'roll' },
];
