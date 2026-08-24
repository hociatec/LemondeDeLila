import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../models/game-shortcuts.model';

export function pressed(key: string): string {
  const trimmed = String(key ?? '').trim();
  return `pressed ${trimmed.toUpperCase()}`;
}

export function interfaceShortcut(key: string, id: string): GameShortcutHint {
  return { key: pressed(key), type: 'interface', id };
}

export function actionShortcut(
  key: string,
  actionType: string,
): GameShortcutHint {
  return { key: pressed(key), type: 'action', actionType };
}

export function when<TMeta>(
  _ctx: GameShortcutsContext<TMeta>,
  condition: boolean,
  shortcuts: readonly GameShortcutHint[],
): GameShortcutHint[] {
  if (!condition) return [];
  return [...shortcuts];
}

export function concat(
  ...parts: Array<readonly GameShortcutHint[]>
): GameShortcutHint[] {
  return parts.flatMap((p) => [...p]);
}
