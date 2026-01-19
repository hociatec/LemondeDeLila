import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import type { PanierExpressMetadata } from './model/panier-express-state.entity';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildPanierExpressShortcuts: GameShortcutsBuilder<
  PanierExpressMetadata
> = () => {
  return [
    interfaceShortcut('S', 'shopping'),
    interfaceShortcut('B', 'basket'),
    interfaceShortcut('I', 'inventory'),
    interfaceShortcut('SHIFT+I', 'inventory_all'),
    interfaceShortcut('P', 'position'),
  ];
};
