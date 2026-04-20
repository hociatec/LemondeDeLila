import type { GameStateWithActions } from '../dto/game-action.dto';
import { extractExtras } from './game-engine-extras';

export function attachViewerContext(
  state: GameStateWithActions,
  userId: number,
): GameStateWithActions {
  const extras = extractExtras(state);

  // Ne pas écraser si un jeu a déjà défini ces champs.
  if (extras['viewerPlayerId'] !== undefined) return state;

  const players = Array.isArray(state.players) ? state.players : [];
  const viewerPlayer = players.find((p) => p?.id === userId) ?? null;
  const viewerPlayerId = viewerPlayer ? viewerPlayer.id : null;
  const viewerUsername =
    viewerPlayer && typeof viewerPlayer.username === 'string'
      ? viewerPlayer.username
      : viewerPlayer
        ? `Joueur ${viewerPlayer.id}`
        : null;

  return {
    ...state,
    extras: {
      ...extras,
      viewerPlayerId,
      viewerUsername,
    },
  };
}
