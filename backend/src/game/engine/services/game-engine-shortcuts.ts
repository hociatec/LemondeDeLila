import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../dto/game-action.dto';
import type { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import type { GameShortcutHint } from '../shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../shortcuts/shortcut-utils';
import { isRollActionType } from '../../actions/action-service.helper';
import { extractExtras } from './game-engine-extras';

export function buildShortcuts(params: {
  state: GameStateWithActions;
  handler: GameRulesAdapter | undefined;
}): GameShortcutHint[] {
  const { state, handler } = params;
  const declared: GameShortcutHint[] = handler?.getShortcuts
    ? handler.getShortcuts({
        metadata: state.metadata ?? {},
        currentPlayerId: state.turn?.currentPlayerId ?? null,
        started: String(state.status ?? '').toLowerCase() === 'started',
      })
    : [];
  return mergeCommonShortcuts(state, declared);
}

export function attachShortcuts(params: {
  state: GameStateWithActions;
  handler: GameRulesAdapter | undefined;
}): GameStateWithActions {
  const { state, handler } = params;
  const extras = extractExtras(state);

  const shortcuts = buildShortcuts({ state, handler });

  return {
    ...state,
    extras: {
      ...extras,
      shortcuts,
    },
  };
}

export function mergeCommonShortcuts(
  state: GameStateWithActions | null | undefined,
  declared: GameShortcutHint[],
): GameShortcutHint[] {
  const common: GameShortcutHint[] = [];

  // Always available: request/announce turn information.
  common.push(interfaceShortcut('T', 'turn'));

  // Rules overlay (client-side): prefer Ctrl+R (avoid interfering with in-game text inputs).
  common.push(interfaceShortcut('Ctrl+R', 'rules'));

  // Action shortcuts: emit only when action exists in the exposed state.
  const actions = Array.isArray(state?.actions)
    ? (state.actions as GameSingleActionDto[])
    : [];
  const types = new Set(
    actions
      .map((a) =>
        typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '',
      )
      .filter((t) => t),
  );

  const hasRoll = Array.isArray(actions)
    ? actions.some((a) => isRollActionType(a?.type))
    : false;
  if (hasRoll) {
    common.push(actionShortcut('ENTER', 'roll'));
  }
  if (types.has('draw')) {
    common.push(actionShortcut('SPACE', 'draw'));
  }
  if (types.has('lama_pass')) {
    common.push(actionShortcut('S', 'lama_pass'));
  }

  const out: GameShortcutHint[] = [];
  const seen = new Set<string>();
  for (const s of [...(Array.isArray(declared) ? declared : []), ...common]) {
    const keyStr = s.key;
    const typeStr = s.type;
    const idStr = typeStr === 'interface' ? String(s.id ?? '') : '';
    const actionTypeStr =
      typeStr === 'action' ? String(s.actionType ?? '') : '';
    const sig = `${keyStr}|${typeStr}|${idStr}|${actionTypeStr}`;
    if (!keyStr || !typeStr) continue;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(s);
  }

  return out;
}
