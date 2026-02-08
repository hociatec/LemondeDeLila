import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import type { PanierExpressMetadata } from './model/panier-express-state.entity';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildPanierExpressShortcuts: GameShortcutsBuilder<
  PanierExpressMetadata
> = () => {
  return [
    interfaceShortcut('S', 'score'),
    interfaceShortcut('L', 'shopping'),
    interfaceShortcut('SHIFT+L', 'shopping_all'),
    interfaceShortcut('B', 'basket'),
    interfaceShortcut('I', 'inventory'),
    interfaceShortcut('SHIFT+I', 'inventory_all'),
    interfaceShortcut('P', 'position'),
  ];
};
