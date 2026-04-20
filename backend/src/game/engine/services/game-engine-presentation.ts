import type { GameStateWithActions } from '../dto/game-action.dto';
import { extractExtras } from './game-engine-extras';

export function stripBoardAndGridIfNotStarted(
  state: GameStateWithActions,
): GameStateWithActions {
  const status = String(state?.status ?? '')
    .toLowerCase()
    .trim();
  if (status === 'started') return state;

  const extras = extractExtras(state);
  const nextExtras = { ...extras };
  if (nextExtras.grid !== undefined) {
    delete nextExtras.grid;
  }

  const out = {
    ...state,
    actions: [],
    pending: null,
    extras: nextExtras,
  } as GameStateWithActions & Record<string, unknown>;
  if (out.board !== undefined) {
    delete out.board;
  }
  return out as GameStateWithActions;
}

export function attachTurnLabel(
  state: GameStateWithActions,
  label: string | null,
): GameStateWithActions {
  if (!label) return state;
  const current = state.turn ?? null;
  if (!current) {
    return { ...state, turn: { currentPlayerId: null, direction: 1, label } };
  }
  return { ...state, turn: { ...current, label } };
}

export function attachCurrentPlayerView(
  state: GameStateWithActions,
): GameStateWithActions {
  const currentPlayerId = state.turn?.currentPlayerId ?? null;
  if (currentPlayerId === null) return state;

  const extras = extractExtras(state);

  // Si le jeu a déjà défini currentPlayerView, on ne l'écrase pas
  if (extras['currentPlayerView'] !== undefined) return state;

  const players = Array.isArray(state.players) ? state.players : [];
  const currentPlayer = players.find((p) => p?.id === currentPlayerId);
  if (!currentPlayer) return state;

  const currentPlayerView = {
    id: currentPlayer.id,
    username: currentPlayer.username ?? `Joueur ${currentPlayer.id}`,
  };

  return {
    ...state,
    extras: {
      ...extras,
      currentPlayerView,
    },
  };
}
