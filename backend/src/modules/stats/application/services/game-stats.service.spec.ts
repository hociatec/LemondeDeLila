import type { CatalogService } from '../../../catalog/public-api';
import type { GameMatchRepository } from '../ports/game-match.repository';
import { GameStatsService } from './game-stats.service';

describe('GameStatsService', () => {
  const match = {
    id: 10,
    roomId: 4,
    gameType: 'lama',
    withBots: false,
    botsCount: 0,
    humansCount: 2,
    startedAt: new Date(),
    endedAt: null,
    endedReason: null,
    winnerUserId: null,
  };
  const setup = () => {
    const repo = {
      createMatchWithPlayers: jest.fn().mockResolvedValue({ ...match }),
      saveMatchWithPlayers: jest.fn().mockResolvedValue(undefined),
      createMatch: jest.fn().mockResolvedValue({ ...match }),
      saveMatch: jest.fn(async (value) => value),
      findActiveMatchByRoomId: jest.fn().mockResolvedValue(null),
      findPlayersByMatchId: jest.fn().mockResolvedValue([]),
      findPlayer: jest.fn(),
      createPlayer: jest.fn(async (value) => ({ id: 1, ...value })),
      createPlayers: jest.fn().mockResolvedValue(undefined),
      savePlayer: jest.fn(async (value) => value),
      savePlayers: jest.fn().mockResolvedValue(undefined),
      findPlayersByUserId: jest.fn().mockResolvedValue([]),
      listFinishedGameTypes: jest.fn().mockResolvedValue([]),
      getTop10: jest.fn().mockResolvedValue([]),
      resetAll: jest.fn(),
    } as jest.Mocked<GameMatchRepository>;
    const catalog = {
      getGame: jest.fn().mockResolvedValue({ name: 'Lama' }),
      getAllGames: jest.fn().mockResolvedValue([{ id: 'lama', name: 'Lama' }]),
    } as unknown as CatalogService;
    return { service: new GameStatsService(repo, catalog), repo };
  };

  it('records one player row per human when a match starts', async () => {
    const { service, repo } = setup();
    await service.startMatch({
      roomId: 4,
      gameType: ' lama ',
      humans: [
        { id: 1, username: 'Alice' },
        { id: 2, username: 'Bob' },
      ],
      botsCount: 0,
    });
    expect(repo.createMatchWithPlayers).toHaveBeenCalledWith({
      match: expect.objectContaining({ gameType: 'lama', humansCount: 2 }),
      players: [
        expect.objectContaining({ userId: 1, username: 'Alice' }),
        expect.objectContaining({ userId: 2, username: 'Bob' }),
      ],
    });
  });

  it('preserves quit outcomes while finalizing winners and losers', async () => {
    const { service, repo } = setup();
    repo.findActiveMatchByRoomId.mockResolvedValue({ ...match });
    const players = [
      {
        id: 1,
        matchId: 10,
        userId: 1,
        username: 'A',
        outcome: 'unknown',
        leftAt: null,
      },
      {
        id: 2,
        matchId: 10,
        userId: 2,
        username: 'B',
        outcome: 'quit',
        leftAt: new Date(),
      },
    ] as any;
    repo.findPlayersByMatchId.mockResolvedValue(players);
    await service.finalizeFinished(4, {
      status: 'finished',
      phase: 'end',
      log: [],
      metadata: { winnerId: 1 } as any,
    });
    expect(players[0].outcome).toBe('won');
    expect(players[1].outcome).toBe('quit');
  });

  it('closes an existing active match before recording a restart', async () => {
    const { service, repo } = setup();
    const active = { ...match };
    repo.findActiveMatchByRoomId
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(null);
    repo.findPlayersByMatchId.mockResolvedValue([]);
    await service.startMatch({
      roomId: 4,
      gameType: 'lama',
      humans: [],
      botsCount: 0,
    });
    expect(active.endedReason).toBe('restart');
    expect(active.endedAt).toBeInstanceOf(Date);
    expect(repo.saveMatchWithPlayers).toHaveBeenCalledWith(active, []);
  });

  it('aggregates finished, quit, won and lost games by bot category', async () => {
    const { service, repo } = setup();
    repo.findPlayersByUserId.mockResolvedValue([
      {
        outcome: 'won',
        match: { gameType: 'lama', withBots: false, endedAt: new Date() },
      },
      {
        outcome: 'lost',
        match: { gameType: 'lama', withBots: true, endedAt: new Date() },
      },
      {
        outcome: 'quit',
        match: { gameType: 'lama', withBots: true, endedAt: new Date() },
      },
    ] as any);
    await expect(service.getMyStats(1)).resolves.toEqual([
      {
        gameType: 'lama',
        gameName: 'Lama',
        withoutBots: { finished: 1, quit: 0, won: 1, lost: 0 },
        withBots: { finished: 1, quit: 1, won: 0, lost: 1 },
      },
    ]);
  });
});
