import type { GameSingleActionDto } from '../../../application/contracts/game-action.model';

export type PresentedGameKeyResolution =
  | { kind: 'action'; action: GameSingleActionDto }
  | { kind: 'interface'; panelId: string; message: string }
  | { kind: 'none' };

export function normalizeGameKey(rawKey: unknown): string {
  let key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (key.toLowerCase().startsWith('pressed ')) {
    key = key.slice('pressed '.length).trim();
  }
  key = key.toUpperCase();
  if (key === 'RETURN') return 'ENTER';
  if (key === 'BACKSPACE') return 'BACK';
  return key;
}

export function resolveGameLifecycleOperation(
  rawKey: unknown,
  rawStatus: unknown,
): 'reset' | 'start' | null {
  const key = normalizeGameKey(rawKey);
  const status = stringValue(rawStatus).toLowerCase();
  const active = status === 'started' || status === 'playing';
  if (key === 'X' && (active || status === 'finished')) return 'reset';
  if (key === 'ENTER' && status === 'finished') return 'reset';
  if (key === 'ENTER' && !active) return 'start';
  return null;
}

export function resolvePresentedGameKey(
  presented: Record<string, unknown>,
  rawKey: unknown,
): PresentedGameKeyResolution {
  const normalized = normalizeGameKey(rawKey);
  if (!normalized) return { kind: 'none' };

  const system = asRecord(presented.system);
  const extras = asRecord(presented.extras);
  const shortcuts = Array.isArray(system.shortcuts)
    ? system.shortcuts
    : Array.isArray(extras.shortcuts)
      ? extras.shortcuts
      : [];
  const candidates = normalized.startsWith('SHIFT+')
    ? [normalized, normalized.slice('SHIFT+'.length)]
    : [normalized];

  for (const candidate of candidates) {
    const matching = shortcuts
      .map(asRecord)
      .filter((shortcut) => normalizeGameKey(shortcut.key) === candidate);
    for (const shortcut of matching) {
      if (shortcut.type !== 'action') continue;
      const actionType = stringValue(shortcut.actionType);
      const action = (Array.isArray(presented.actions) ? presented.actions : [])
        .map(asRecord)
        .find(
          (entry) =>
            stringValue(entry.type) === actionType && entry.disabled !== true,
        );
      if (!action) continue;
      return {
        kind: 'action',
        action: { type: actionType, payload: asRecord(action.payload) },
      };
    }
    for (const shortcut of matching) {
      if (shortcut.type !== 'interface') continue;
      const panelId = stringValue(shortcut.id);
      if (!panelId) continue;
      const panels = asRecord(asRecord(extras.ui).panels);
      const message = stringValue(asRecord(panels[panelId]).message);
      return { kind: 'interface', panelId, message };
    }
  }
  return { kind: 'none' };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
