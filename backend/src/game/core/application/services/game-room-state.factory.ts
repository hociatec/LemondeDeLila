import { Injectable } from '@nestjs/common';
import type {
  GameStateMetadata,
  GameState,
  PlayerState,
} from '../models/game-state.model';
import { ensureSeededRng } from '../random/seeded-rng';
import { seededShuffle } from '../random/seeded-shuffle';
import { resolveGameStateRunId } from '../helpers/game-room-run-id.helper';
import { gameNowIso } from './game-execution-scope.service';

type GameRoomPayload = {
  room: {
    id: number;
    status: string;
    startedAt?: Date | string | null;
    runId?: number | null;
    owner: { id: number } | null;
    players: Array<{ id: number; username: string }>;
    bots: Array<{ id: number; name: string }>;
  };
};

@Injectable()
export class GameRoomStateFactory {
  build(payload: GameRoomPayload, gameType: string): GameState {
    if (
      !payload?.room ||
      !Number.isSafeInteger(payload.room.id) ||
      payload.room.id <= 0 ||
      typeof gameType !== 'string' ||
      !gameType.trim() ||
      gameType.length > 128
    ) {
      throw new Error('Invalid game room payload');
    }
    const status = payload.room.status || 'setup';
    const roomOwnerId = payload.room.owner?.id ?? null;
    const metadata: GameStateMetadata = {
      roomId: payload.room.id,
      roomOwnerId,
      gameType,
      roomStartedAt: payload.room.startedAt ?? null,
      roomRunId: resolveGameStateRunId(payload.room),
      generatedAt: gameNowIso(),
    };
    const rng = ensureSeededRng(metadata);
    metadata.rng = rng;
    const basePlayers = this.players(payload);
    const players =
      status.toLowerCase() === 'started'
        ? seededShuffle(basePlayers, rng.seed, 'game-runtime:starter')
        : basePlayers;
    metadata.ownerPlayerId =
      roomOwnerId != null && players.some((player) => player.id === roomOwnerId)
        ? roomOwnerId
        : (players[0]?.id ?? null);

    return {
      status,
      phase: 'playing',
      log: [],
      players,
      turn: { currentPlayerId: players[0]?.id ?? null, direction: 1 },
      metadata,
    };
  }

  private players(payload: GameRoomPayload): PlayerState[] {
    const humans = (
      Array.isArray(payload.room.players) ? payload.room.players : []
    )
      .slice(0, 64)
      .filter((player) => Number.isSafeInteger(player?.id) && player.id > 0)
      .map((player) => ({
        id: player.id,
        username: sanitizePlayerName(player.username),
        isBot: false,
      }));
    const bots = (Array.isArray(payload.room.bots) ? payload.room.bots : [])
      .slice(0, 64)
      .filter((bot) => Number.isSafeInteger(bot?.id) && bot.id > 0)
      .map((bot) => ({
        id: -Math.abs(bot.id),
        username: sanitizePlayerName(bot.name),
        isBot: true,
      }));
    return [...humans, ...bots];
  }
}

function sanitizePlayerName(raw: string): string {
  let name = (typeof raw === 'string' ? raw : '')
    .slice(0, 255)
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^"|"$/g, '')
    .trim();
  const lowered = name.toLowerCase();
  if (
    lowered.endsWith('(zone de jeu)') ||
    lowered.endsWith('(zone de jeux)') ||
    lowered.endsWith('(game zone)')
  )
    name = name.slice(0, name.lastIndexOf('(')).trimEnd();
  return name;
}
