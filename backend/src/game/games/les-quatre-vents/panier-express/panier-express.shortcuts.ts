import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import type { PanierExpressMetadata } from './model/panier-express-state.model';
import { interfaceShortcut } from '../../../application/helpers/shortcut-utils';

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


