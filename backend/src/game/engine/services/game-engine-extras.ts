import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../dto/game-action.dto';

export function extractExtras(
  state: GameStateWithActions | GameStateEntity | null | undefined,
): Record<string, unknown> {
  if (!state) {
    return {};
  }
  const candidate =
    'extras' in state ? (state as { extras?: unknown }).extras : undefined;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>;
  }
  return {};
}

export function extractUi(
  extras: Record<string, unknown>,
): Record<string, unknown> | null {
  const uiRaw = extras['ui'];
  if (uiRaw && typeof uiRaw === 'object' && !Array.isArray(uiRaw)) {
    return uiRaw as Record<string, unknown>;
  }
  return null;
}

export function extractPanels(
  ui: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!ui) {
    return null;
  }
  const panelsRaw = ui['panels'];
  if (panelsRaw && typeof panelsRaw === 'object' && !Array.isArray(panelsRaw)) {
    return panelsRaw as Record<string, unknown>;
  }
  return null;
}

export function extractPanelMessage(
  panel: Record<string, unknown> | undefined,
): string {
  if (!panel) {
    return '';
  }
  const message = panel['message'];
  return typeof message === 'string' ? message.trim() : '';
}
