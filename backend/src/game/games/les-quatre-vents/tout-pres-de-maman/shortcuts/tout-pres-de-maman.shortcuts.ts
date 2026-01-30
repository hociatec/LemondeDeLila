import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';

export const buildToutPresDeMamanShortcuts: GameShortcutsBuilder = () => [
  { key: 'roll', type: 'action', actionType: 'roll' },
];
