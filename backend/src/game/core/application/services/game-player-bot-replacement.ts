import type { GameState } from '../models/game-state.model';
import type { GameRoomPayload } from '../ports/game-room.port';

/** Keep seat IDs stable: cards, scores, pending choices and turns reference them. */
export function replaceDepartedPlayersWithBots(
  state: GameState,
  payload: GameRoomPayload,
): GameState {
  if (payload.room.status !== 'started' || state.status === 'finished')
    return state;
  const players = state.players ?? [];
  const humans = new Set<number>(
    (payload.room.players ?? []).map((player) => player.id),
  );
  const occupied = new Set(
    players
      .filter((player) => player.isBot)
      .map((player) => player.replacementBotPlayerId ?? player.id),
  );
  const available = (payload.room.bots ?? []).filter(
    (bot) => !occupied.has(-bot.id),
  );
  const departed = players.filter(
    (player) => !player.isBot && !humans.has(player.id),
  );
  if (!departed.length || !available.length) return state;

  const next = structuredClone(state);
  for (const player of next.players ?? []) {
    if (player.isBot || humans.has(player.id)) continue;
    const bot = available.shift();
    if (!bot) break;
    player.isBot = true;
    player.username = bot.name;
    player.replacementBotPlayerId = -bot.id;
  }
  if (next.metadata) {
    next.metadata.roomOwnerId = payload.room.owner?.id ?? null;
    next.metadata.ownerPlayerId = payload.room.owner?.id ?? null;
  }
  return next;
}
