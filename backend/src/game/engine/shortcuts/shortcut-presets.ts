import type { GameShortcutHint } from './game-shortcuts';
import { interfaceShortcut } from './shortcut-utils';

export function positionOnlyShortcuts(): GameShortcutHint[] {
  return [interfaceShortcut('P', 'position')];
}

export function stableAndPositionShortcuts(): GameShortcutHint[] {
  return [interfaceShortcut('S', 'stable'), interfaceShortcut('P', 'position')];
}

