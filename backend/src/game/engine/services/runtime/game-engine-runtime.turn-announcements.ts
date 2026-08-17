import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import {
  extractPawnPromptToken,
  normalizePromptToken,
} from '../game-engine.prompt-token';

export function ensureRandomStarterAtGameStart(params: {
  baseState: GameStateEntity;
  state: GameStateEntity;
  toMetadata: (state: { metadata?: unknown }) => Record<string, unknown>;
}): GameStateEntity {
  const { baseState, state, toMetadata } = params;
  const status = String(state.status ?? '')
    .toLowerCase()
    .trim();
  if (status !== 'started') return state;

  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) return state;

  const pending = state.pending ?? null;
  const pendingPlayerId =
    typeof pending?.playerId === 'number' ? pending.playerId : null;
  const blockingPending = pending?.blocking === true;
  if (blockingPending && pendingPlayerId != null) {
    return state;
  }

  const starterMeta = toMetadata(state);
  if (starterMeta['starterChosenAfterPawnSelection'] === true) {
    return state;
  }

  const baseStarterId = baseState.turn?.currentPlayerId ?? null;
  const starterId =
    typeof baseStarterId === 'number' &&
    players.some((p) => p?.id === baseStarterId)
      ? baseStarterId
      : (players[0]?.id ?? null);
  if (typeof starterId !== 'number') return state;

  const currentId = state.turn?.currentPlayerId ?? null;
  const starterIndex = Math.max(
    0,
    players.findIndex((p) => p?.id === starterId),
  );
  const currentTurnIndex =
    typeof state.turnIndex === 'number' ? state.turnIndex : 0;
  if (currentId === starterId && currentTurnIndex === starterIndex) {
    return state;
  }

  return {
    ...state,
    turnIndex: starterIndex,
    turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: starterId },
  };
}

function removeRecentTurnAnnouncements(
  state: GameStateEntity,
): GameStateEntity {
  const log = Array.isArray(state.log) ? [...state.log] : [];
  let changed = false;
  for (let i = log.length - 1; i >= 0 && i >= log.length - 6; i -= 1) {
    const message =
      typeof log[i]?.message === 'string' ? String(log[i].message).trim() : '';
    if (!message.toLowerCase().startsWith("c'est au tour de ")) continue;
    log.splice(i, 1);
    changed = true;
  }
  return changed ? { ...state, log } : state;
}

export function appendFirstTurnAnnouncement(params: {
  state: GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  normalizeUsernameForLog: (username: unknown) => string;
}): GameStateEntity {
  const { appendLog, normalizeUsernameForLog } = params;
  const { state } = params;

  const status = String(state.status ?? '')
    .toLowerCase()
    .trim();
  if (status !== 'started') {
    return state;
  }

  const pending = state.pending ?? null;
  const pendingType = String(pending?.type ?? '')
    .trim()
    .toLowerCase();
  const announcementPlayerId =
    pendingType === 'choose_pawn' || pendingType === 'pick_pawn'
      ? (pending?.playerId ?? null)
      : (state.turn?.currentPlayerId ?? null);
  if (
    typeof announcementPlayerId !== 'number' ||
    !Number.isFinite(announcementPlayerId)
  ) {
    return state;
  }

  const players = Array.isArray(state.players) ? state.players : [];
  const name =
    normalizeUsernameForLog(
      players.find((p) => p?.id === announcementPlayerId)?.username,
    ) || `Joueur ${announcementPlayerId}`;

  const log = Array.isArray(state.log) ? state.log : [];
  const recentMessages = log
    .slice(-6)
    .map((entry) => String(entry?.message ?? '').trim());
  if (pendingType === 'choose_pawn' || pendingType === 'pick_pawn') {
    const expectedPromptToken = `prompt:choose-pawn:${normalizePromptToken(name)}`;
    const hasSamePrompt = recentMessages.some(
      (message) => extractPawnPromptToken(message) === expectedPromptToken,
    );
    const cleaned = removeRecentTurnAnnouncements(state);
    if (hasSamePrompt) {
      return cleaned;
    }
    return appendLog(cleaned, `C'est à ${name} de choisir son pion.`);
  }

  if (
    recentMessages.some((message) =>
      message.toLowerCase().startsWith("c'est au tour de "),
    )
  ) {
    return state;
  }

  const hasRecentPawnSetupLogs = recentMessages.some((message) =>
    /a choisi le pion:/i.test(message),
  );
  return appendLog(
    state,
    hasRecentPawnSetupLogs
      ? `C'est au tour de ${name} de débuter.`
      : `C'est au tour de ${name}.`,
  );
}
