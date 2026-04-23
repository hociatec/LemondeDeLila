import type {
  RoomBotState,
  RoomPayload,
  RoomPlayer,
} from '../../../../room/dto/room-response.dto';
import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../core/entities/game-state.entity';

export function syncRosterForStartedRoom(params: {
  state: GameStateEntity;
  payload: RoomPayload;
  buildPlayersFromPayload: (payload: RoomPayload) => PlayerStateEntity[];
  normalizeUsernameForLog: (username: unknown) => string;
}): GameStateEntity {
  const { payload, buildPlayersFromPayload, normalizeUsernameForLog } = params;
  let { state } = params;
  try {
    let changed = false;
    if (
      !state ||
      String(state.status ?? '').toLowerCase().trim() !== 'started'
    ) {
      return state;
    }
    let players = state.players ?? [];
    const desiredPlayers = buildPlayersFromPayload(payload);
    if (players.length === 0 && desiredPlayers.length === 0) {
      return state;
    }
    if (players.length === 0 && desiredPlayers.length > 0) {
      players = desiredPlayers;
      changed = true;
    }

    const desiredById = new Map<number, PlayerStateEntity>();
    for (const player of desiredPlayers) {
      const id = Number(player?.id);
      if (!Number.isFinite(id) || id === 0) continue;
      desiredById.set(id, player);
    }

    const roomPlayers: RoomPlayer[] = Array.isArray(payload?.room?.players)
      ? payload.room.players
      : [];
    const roomBots: RoomBotState[] = Array.isArray(payload?.room?.bots)
      ? payload.room.bots
      : [];

    const humanById = new Map<number, string>();
    for (const p of roomPlayers) {
      const id = p.id;
      if (!Number.isFinite(id) || id <= 0) continue;
      const username = normalizeUsernameForLog(p.username);
      if (!username) continue;
      humanById.set(id, username);
    }

    const roomBotNames = roomBots
      .map((b) => normalizeUsernameForLog(b.name))
      .filter((n) => n.length > 0);
    const allowedBotNames = new Set(roomBotNames);

    const allowedBotIds = new Set<number>(
      roomBots
        .map((b) => -Math.abs(b.id))
        .filter((id) => Number.isFinite(id) && id < 0),
    );

    const mappedPlayers = players.map((p) => {
      const id = p.id;
      if (!Number.isFinite(id) || id === 0) return p;

      const desired = desiredById.get(id) ?? null;
      if (desired) {
        const desiredUsername = normalizeUsernameForLog(desired.username);
        const currentUsername = normalizeUsernameForLog(p.username);
        const desiredIsBot = desired.isBot === true;
        if (p.isBot !== desiredIsBot || currentUsername !== desiredUsername) {
          changed = true;
          return {
            ...p,
            username: desiredUsername || p.username,
            isBot: desiredIsBot,
          };
        }
        return p;
      }

      const roomUsername = humanById.get(id) ?? null;
      const isBot = p.isBot === true;

      if (roomUsername) {
        if (isBot || normalizeUsernameForLog(p.username) !== roomUsername) {
          changed = true;
          return { ...p, isBot: false, username: roomUsername };
        }
        return p;
      }

      return p;
    });

    const preserveBotIds = new Set<number>();
    const currentTurnPlayerId = state.turn?.currentPlayerId ?? null;
    if (
      typeof currentTurnPlayerId === 'number' &&
      currentTurnPlayerId < 0 &&
      mappedPlayers.some(
        (player) => player?.id === currentTurnPlayerId && player?.isBot === true,
      )
    ) {
      preserveBotIds.add(currentTurnPlayerId);
    }
    const pendingPlayerId =
      typeof state.pending?.playerId === 'number' ? state.pending.playerId : null;
    if (
      typeof pendingPlayerId === 'number' &&
      pendingPlayerId < 0 &&
      mappedPlayers.some(
        (player) => player?.id === pendingPlayerId && player?.isBot === true,
      )
    ) {
      preserveBotIds.add(pendingPlayerId);
    }

    const filteredPlayers = mappedPlayers.filter((p) => {
      const id = p.id;
      if (!Number.isFinite(id) || id === 0) return true;
      const isBot = p.isBot === true;
      if (id < 0) {
        if (!isBot) return true;
        if (allowedBotIds.has(id)) return true;
        return preserveBotIds.has(id);
      }
      if (!isBot) return true;
      const name = normalizeUsernameForLog(p.username);
      return Boolean(name && allowedBotNames.has(name));
    });
    const nextPlayers = filteredPlayers;
    if (nextPlayers.length !== mappedPlayers.length) {
      changed = true;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (
      typeof currentPlayerId === 'number' &&
      currentPlayerId !== 0 &&
      !nextPlayers.some((p) => p?.id === currentPlayerId)
    ) {
      const prevIndex = Math.max(0, players.findIndex((p) => p?.id === currentPlayerId));
      const fallbackIndex = Math.min(prevIndex, Math.max(0, nextPlayers.length - 1));
      const fallbackId = nextPlayers[fallbackIndex]?.id ?? nextPlayers[0]?.id ?? null;
      if (fallbackId !== currentPlayerId) {
        changed = true;
        state = {
          ...state,
          turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: fallbackId },
        };
      }
    }

    const nextPendingPlayerId = state.pending?.playerId ?? null;
    if (
      typeof nextPendingPlayerId === 'number' &&
      nextPendingPlayerId !== 0 &&
      !nextPlayers.some((p) => p?.id === nextPendingPlayerId)
    ) {
      changed = true;
      state = {
        ...state,
        pending: state.pending ? { ...state.pending, playerId: null } : state.pending,
      };
    }

    return changed ? { ...state, players: nextPlayers } : state;
  } catch {
    return state;
  }
}

export function buildPlayersFromPayload(params: {
  payload: RoomPayload;
  normalizeUsernameForLog: (username: unknown) => string;
}): PlayerStateEntity[] {
  const { payload, normalizeUsernameForLog } = params;
  const result: PlayerStateEntity[] = [];
  const roomPlayers: RoomPlayer[] = Array.isArray(payload?.room?.players)
    ? payload.room.players
    : [];
  for (const player of roomPlayers) {
    const pid =
      typeof player?.id === 'number' ? player.id : Number(player?.id ?? NaN);
    if (!Number.isFinite(pid) || pid === 0) continue;
    const username = normalizeUsernameForLog(player.username);
    if (!username) continue;
    result.push({ id: pid, username, isBot: false });
  }
  const roomBots: RoomBotState[] = Array.isArray(payload?.room?.bots)
    ? payload.room.bots
    : [];
  for (const bot of roomBots) {
    const rawId =
      typeof bot?.id === 'number'
        ? bot.id
        : typeof bot?.id === 'string'
          ? Number(bot.id)
          : NaN;
    if (!Number.isFinite(rawId)) continue;
    const pid = -Math.abs(rawId);
    if (pid === 0) continue;
    result.push({
      id: pid,
      username: normalizeUsernameForLog(bot.name) || `Bot ${Math.abs(pid)}`,
      isBot: true,
    });
  }
  return result;
}
