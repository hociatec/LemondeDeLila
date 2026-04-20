import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../dto/game-action.dto';
import type { BoardPayloadService } from '../../modules/board/services/board-payload.service';
import { extractExtras, extractPanels, extractUi } from './game-engine-extras';

function tryBuildCanonicalGridPositionPanelMessage(params: {
  internalMeta: Record<string, unknown>;
  boardRaw: Record<string, unknown>;
  playersRaw: unknown;
  normalizeString: (value: unknown) => string;
}): string {
  const { internalMeta, boardRaw, playersRaw, normalizeString } = params;
  const sizeRaw = internalMeta['size'] ?? boardRaw['size'] ?? null;
  const size = Number(sizeRaw);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }

  const rawPositions =
    internalMeta['pawnsByPlayerId'] ?? boardRaw['pawnsByPlayerId'] ?? null;
  if (!rawPositions || typeof rawPositions !== 'object') {
    return '';
  }

  const players = Array.isArray(playersRaw) ? playersRaw : [];
  const namesById = new Map<number, string>();
  for (const player of players) {
    if (!player || typeof player !== 'object') continue;
    const record = player as Record<string, unknown>;
    const id = Number(record['id']);
    if (!Number.isFinite(id) || id === 0) continue;
    const username = normalizeString(record['username']).trim();
    namesById.set(id, username || `Joueur ${id}`);
  }

  const entries = Object.entries(rawPositions as Record<string, unknown>)
    .map(([rawId, rawPos]) => {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id === 0) return null;
      if (!rawPos || typeof rawPos !== 'object') return null;
      const pos = rawPos as Record<string, unknown>;
      const x = Number(pos['x']);
      const y = Number(pos['y']);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const name = namesById.get(id) ?? `Joueur ${id}`;
      return {
        id,
        line: `${name} ${toGridCellRef(Math.trunc(x), Math.trunc(y), Math.trunc(size)).toLowerCase()}`,
      };
    })
    .filter((entry): entry is { id: number; line: string } => entry != null)
    .sort((a, b) => a.id - b.id);

  if (entries.length === 0) {
    return '';
  }

  return `Positions. ${entries.map((entry) => entry.line).join('. ')}.`;
}

function toGridCellRef(x: number, y: number, size: number): string {
  const safeSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
  if (safeSize <= 0) {
    return `${x},${y}`;
  }

  let n = Math.max(1, Math.trunc(x) + 1);
  let col = '';
  while (n > 0) {
    n -= 1;
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26);
  }
  const row = Math.max(1, safeSize - Math.trunc(y));
  return `${col}${row}`;
}

export function buildCanonicalPositionPanelMessage(params: {
  internal: GameStateEntity | null | undefined;
  state: GameStateWithActions | null | undefined;
  boardPayload: BoardPayloadService;
  normalizeString: (value: unknown) => string;
}): string {
  const { internal, state, boardPayload, normalizeString } = params;
  const internalMeta =
    internal?.metadata && typeof internal.metadata === 'object'
      ? (internal.metadata as Record<string, unknown>)
      : {};
  const boardRaw =
    state?.board && typeof state.board === 'object'
      ? (state.board as Record<string, unknown>)
      : {};
  const playersRaw =
    Array.isArray(internal?.players) && internal.players.length > 0
      ? internal.players
      : state?.players;

  const tilesRaw = internalMeta['tiles'] ?? boardRaw['tiles'] ?? null;
  const positionsRaw =
    internalMeta['positions'] ?? boardRaw['positions'] ?? null;
  const lapsRaw = internalMeta['laps'] ?? boardRaw['laps'] ?? null;

  if (tilesRaw && positionsRaw) {
    return boardPayload.buildPositionPanelMessage({
      tilesRaw,
      positionsRaw,
      lapsRaw,
      playerId: null,
      playersRaw,
    });
  }

  const pawnsByPlayerRaw =
    internalMeta['pawnsByPlayer'] ?? boardRaw['pawnsByPlayer'] ?? null;
  const trackLengthRaw =
    internalMeta['trackLength'] ?? boardRaw['trackLength'] ?? null;
  if (pawnsByPlayerRaw && trackLengthRaw) {
    return boardPayload.buildPawnProgressPositionPanelMessage({
      playersRaw,
      pawnsByPlayerRaw,
      trackLengthRaw,
      homeLengthRaw:
        internalMeta['homeLength'] ?? boardRaw['homeLength'] ?? null,
      offsetsRaw: internalMeta['offsets'] ?? boardRaw['offsets'] ?? null,
      pawnNamesByPlayerRaw:
        internalMeta['pawnNamesByPlayer'] ??
        boardRaw['pawnNamesByPlayer'] ??
        null,
    });
  }

  return tryBuildCanonicalGridPositionPanelMessage({
    internalMeta,
    boardRaw,
    playersRaw,
    normalizeString,
  });
}

export function attachCanonicalPositionPanel(params: {
  state: GameStateWithActions;
  internal: GameStateEntity;
  userId: number | null;
  boardPayload: BoardPayloadService;
  normalizeString: (value: unknown) => string;
}): GameStateWithActions {
  const { state, internal, userId, boardPayload, normalizeString } = params;
  const status = String(state?.status ?? '')
    .toLowerCase()
    .trim();
  if (status !== 'started') {
    return state;
  }

  const message = buildCanonicalPositionPanelMessage({
    internal,
    state,
    boardPayload,
    normalizeString,
  });
  if (!message) {
    return state;
  }

  const extras = extractExtras(state);
  const uiExisting = extractUi(extras);
  const ui = uiExisting ? { ...uiExisting } : {};
  const panelsExisting = extractPanels(uiExisting);
  const panels = panelsExisting ? { ...panelsExisting } : {};
  const current =
    (panels['position'] as Record<string, unknown> | undefined) ?? {};
  const title =
    typeof current['title'] === 'string' && String(current['title']).trim()
      ? String(current['title']).trim()
      : 'Position';

  panels['position'] = {
    ...current,
    title,
    message,
    scope: 'global',
    source: 'canonical',
    viewerPlayerId: userId,
  };
  ui['panels'] = panels;

  return {
    ...state,
    extras: {
      ...extras,
      ui,
    },
  };
}
