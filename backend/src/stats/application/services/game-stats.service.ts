import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CatalogService } from '../../../catalog/public-api';
import type { GameStateEntity } from '../../../game/public-api';
import { GameStatsGameTypeRequiredError } from '../../domain/errors/game-stats-domain.errors';
import {
  GameMatchOutcome,
  type GameMatchPlayerRecord,
} from '../models/game-match-player.model';
import type { GameMatchRecord } from '../models/game-match.model';
import {
  GAME_MATCH_REPOSITORY,
  type GameMatchRepository,
} from '../ports/game-match.repository';

export type MyStatsCounts = {
  finished: number;
  quit: number;
  won: number;
  lost: number;
};

export type MyGameStats = {
  gameType: string;
  gameName: string;
  withBots: MyStatsCounts;
  withoutBots: MyStatsCounts;
};

export type LeaderboardGame = { gameType: string; gameName: string };

export type LeaderboardEntry = {
  userId: number;
  username: string;
  wins: number;
  losses: number;
  finished: number;
  quit: number;
};

@Injectable()
export class GameStatsService {
  private readonly logger = new Logger(GameStatsService.name);

  constructor(
    @Inject(GAME_MATCH_REPOSITORY)
    private readonly statsRepo: GameMatchRepository,
    private readonly catalog: CatalogService,
  ) {}

  async startMatch(params: {
    roomId: number;
    gameType: string;
    humans: Array<{ id: number; username: string }>;
    botsCount: number;
  }): Promise<GameMatchRecord> {
    const gameType = (params.gameType ?? '').trim();
    if (!gameType) {
      throw new GameStatsGameTypeRequiredError();
    }

    // Fermer tout match actif de la room (robustesse).
    await this.closeActiveMatch(params.roomId, 'restart');

    const match = await this.statsRepo.createMatch({
      roomId: params.roomId,
      gameType,
      botsCount: params.botsCount,
      humansCount: params.humans.length,
      withBots: params.botsCount > 0,
    });

    for (const h of params.humans) {
      await this.statsRepo.createPlayer({
        matchId: match.id,
        userId: h.id,
        username: h.username,
        outcome: 'unknown',
        leftAt: null,
      });
    }

    return match;
  }

  async markQuit(roomId: number, userId: number): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;
    const row = await this.statsRepo.findPlayer(match.id, userId);
    if (!row) return;
    if (
      row.outcome === 'won' ||
      row.outcome === 'lost' ||
      row.outcome === 'draw'
    ) {
      return;
    }
    row.outcome = 'quit';
    row.leftAt = row.leftAt ?? new Date();
    await this.statsRepo.savePlayer(row);
  }

  async endMatchOnReset(roomId: number): Promise<void> {
    await this.closeActiveMatch(roomId, 'reset');
  }

  async finalizeFinished(
    roomId: number,
    state: GameStateEntity,
  ): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;

    const winnerRaw = this.extractWinnerId(state.metadata);
    const winnerId = typeof winnerRaw === 'number' ? winnerRaw : null;
    const cooperative =
      typeof winnerRaw === 'string' && winnerRaw.trim() !== '';

    match.endedAt = new Date();
    match.endedReason = 'finished';
    match.winnerUserId = winnerId;
    await this.statsRepo.saveMatch(match);

    const rows = await this.statsRepo.findPlayersByMatchId(match.id);
    for (const row of rows) {
      if (row.outcome === 'quit') {
        continue;
      }

      row.outcome = this.resolveOutcome(row.userId, winnerId, cooperative);
      await this.statsRepo.savePlayer(row);
    }
  }

  async getMyStats(userId: number): Promise<MyGameStats[]> {
    const rows = await this.statsRepo.findPlayersByUserId(userId);

    const byGame = new Map<
      string,
      { withBots: MyStatsCounts; withoutBots: MyStatsCounts }
    >();

    for (const r of rows) {
      const match = r.match ?? undefined;
      if (!match) continue;

      const key = match.gameType;
      if (!byGame.has(key)) {
        byGame.set(key, {
          withBots: { finished: 0, quit: 0, won: 0, lost: 0 },
          withoutBots: { finished: 0, quit: 0, won: 0, lost: 0 },
        });
      }
      const bucket = byGame.get(key)!;
      const target = match.withBots ? bucket.withBots : bucket.withoutBots;

      // Quit = partie quittÃ©e avant la fin (ou reset)
      if (r.outcome === 'quit') {
        target.quit += 1;
        continue;
      }

      // On ne compte "terminÃ©e" que si le match est clÃ´turÃ©.
      if (match.endedAt) {
        target.finished += 1;
      }
      if (r.outcome === 'won') target.won += 1;
      if (r.outcome === 'lost') target.lost += 1;
    }

    const results: MyGameStats[] = [];
    for (const [gameType, counts] of byGame.entries()) {
      const manifest = await this.catalog.getGame(gameType);
      results.push({
        gameType,
        gameName: manifest?.name ?? gameType,
        withBots: counts.withBots,
        withoutBots: counts.withoutBots,
      });
    }

    results.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
    return results;
  }

  async getLeaderboardGames(): Promise<LeaderboardGame[]> {
    const list: LeaderboardGame[] = [];
    for (const gameType of await this.statsRepo.listFinishedGameTypes()) {
      if (!gameType) continue;
      const manifest = await this.catalog.getGame(gameType);
      list.push({ gameType, gameName: manifest?.name ?? gameType });
    }

    list.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
    return list;
  }

  async getTop10(gameType: string): Promise<LeaderboardEntry[]> {
    const normalized = (gameType ?? '').trim();
    if (!normalized) return [];

    return this.statsRepo.getTop10(normalized);
  }

  private resolveOutcome(
    userId: number,
    winnerId: number | null,
    cooperative: boolean,
  ): GameMatchOutcome {
    if (cooperative) {
      return 'won';
    }
    if (winnerId == null) {
      return 'lost';
    }
    return userId === winnerId ? 'won' : 'lost';
  }

  private async getActiveMatch(roomId: number): Promise<GameMatchRecord | null> {
    return this.statsRepo.findActiveMatchByRoomId(roomId);
  }

  private async closeActiveMatch(
    roomId: number,
    reason: string,
  ): Promise<void> {
    const match = await this.getActiveMatch(roomId);
    if (!match) return;

    match.endedAt = new Date();
    match.endedReason = reason;
    match.winnerUserId = null;
    await this.statsRepo.saveMatch(match);

    const rows = await this.statsRepo.findPlayersByMatchId(match.id);
    for (const row of rows) {
      if (
        row.outcome === 'won' ||
        row.outcome === 'lost' ||
        row.outcome === 'draw'
      ) {
        continue;
      }
      row.outcome = 'quit';
      row.leftAt = row.leftAt ?? new Date();
      await this.statsRepo.savePlayer(row);
    }

    this.logger.warn(`Match actif clos (roomId=${roomId}, reason=${reason})`);
  }

  async resetAllStats(): Promise<{
    deletedPlayers: number;
    deletedMatches: number;
  }> {
    return this.statsRepo.resetAll();
  }

  private extractWinnerId(metadata: unknown): unknown {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    return (metadata as Record<string, unknown>).winnerId ?? null;
  }
}
