import type { Repository } from 'typeorm';
import type { GameMatchRecord } from '../../../../application/contracts/game-match.model';
import type {
  GameMatchPlayerRecord,
  GameMatchSummary,
} from '../../../../application/contracts/game-match-player.model';
import { GameMatchEntity } from '../entities/game-match.entity';
import { GameMatchPlayerEntity } from '../entities/game-match-player.entity';

export function toGameMatchModel(match: GameMatchEntity): GameMatchRecord {
  return { ...toGameMatchSummary(match) };
}

export function toGameMatchSummary(match: GameMatchEntity): GameMatchSummary {
  return {
    id: match.id,
    roomId: match.roomId,
    gameType: match.gameType,
    withBots: match.withBots,
    botsCount: match.botsCount,
    humansCount: match.humansCount,
    startedAt: match.startedAt,
    endedAt: match.endedAt ?? null,
    endedReason: match.endedReason ?? null,
    winnerUserId: match.winnerUser?.id ?? null,
  };
}

export function toGameMatchEntity(
  repository: Repository<GameMatchEntity>,
  match: GameMatchRecord,
): GameMatchEntity {
  return repository.create({
    id: match.id,
    roomId: match.roomId,
    gameType: match.gameType,
    withBots: match.withBots,
    botsCount: match.botsCount,
    humansCount: match.humansCount,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    endedReason: match.endedReason,
    winnerUser: match.winnerUserId != null ? { id: match.winnerUserId } : null,
  });
}

export function toGameMatchPlayerEntity(
  repository: Repository<GameMatchPlayerEntity>,
  player: GameMatchPlayerRecord,
): GameMatchPlayerEntity {
  return repository.create({
    id: player.id,
    match: { id: player.matchId } as GameMatchEntity,
    user: { id: player.userId },
    username: player.username,
    outcome: player.outcome,
    leftAt: player.leftAt,
  });
}

export function toGameMatchPlayerModel(
  player: GameMatchPlayerEntity,
): GameMatchPlayerRecord {
  return {
    id: player.id,
    matchId: player.match?.id ?? 0,
    userId: player.user.id,
    username: player.username,
    outcome: player.outcome,
    leftAt: player.leftAt ?? null,
    match: player.match ? toGameMatchSummary(player.match) : null,
  };
}
