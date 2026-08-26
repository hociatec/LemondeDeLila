import type { GameStateEntity } from '../models/game-state.model';

type PlayerLike =
  { id?: number | string; username?: string | null } | null | undefined;

export interface ResolvePlayerNameOptions {
  coerceNumericIds?: boolean;
  collapseWhitespace?: boolean;
  unwrapDoubleQuotes?: boolean;
}

export function resolvePlayerName(
  players: GameStateEntity['players'] | PlayerLike[] | null | undefined,
  playerId: number,
  options?: ResolvePlayerNameOptions,
): string {
  const safePlayers = Array.isArray(players) ? players : [];
  const match = safePlayers.find((player) => {
    const id = player?.id;
    if (options?.coerceNumericIds) return Number(id) === playerId;
    return id === playerId;
  });
  let username =
    match?.username && String(match.username).trim()
      ? String(match.username).trim()
      : null;
  if (username && options?.collapseWhitespace) {
    username = username
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  if (username && options?.unwrapDoubleQuotes) {
    username = username.replace(/^"(.*)"$/u, '$1').trim();
  }
  return username ?? `Joueur ${playerId}`;
}

export function resolvePlayerNameFromState(
  state: Pick<GameStateEntity, 'players'> | null | undefined,
  playerId: number,
  options?: ResolvePlayerNameOptions,
): string {
  return resolvePlayerName(state?.players, playerId, options);
}
