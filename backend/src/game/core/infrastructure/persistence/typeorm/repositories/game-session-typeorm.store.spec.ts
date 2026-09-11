import type { Repository } from 'typeorm';
import { GameSessionTypeormStore } from './game-session-typeorm.store';
import type { GameSessionEntity } from '../entities/game-session.entity';
import type { GameState } from '../../../../application/models/game-state.model';
import {
  asGameId,
  asRoomId,
} from '../../../../../../shared/interfaces/public-api';

it('checks restoration identity while holding the SQL row lock and performs no writes on conflict', async () => {
  const state: GameState = {
    status: 'started',
    phase: 'playing',
    log: [],
    version: 4,
    metadata: { restoreId: 'new-restore' },
  };
  const findOne = jest.fn().mockResolvedValue({ version: 4, state });
  const save = jest.fn();
  const manager = { getRepository: () => ({ findOne, save }) };
  const repository = {
    manager: {
      transaction: async (work: (value: typeof manager) => Promise<unknown>) =>
        work(manager),
    },
  } as unknown as Repository<GameSessionEntity>;
  const store = new GameSessionTypeormStore(repository);
  const result = await store.compareAndSet({
    roomId: asRoomId(12),
    gameType: asGameId('example'),
    expectedVersion: 4,
    expectedRestoreId: 'old-restore',
    next: { ...state, metadata: { restoreId: 'old-restore' } },
    pendingEvents: [],
    occurredAtMs: 100,
  });
  expect(findOne).toHaveBeenCalledWith({
    where: { roomId: 12, gameType: 'example' },
    lock: { mode: 'pessimistic_write' },
  });
  expect(result).toEqual({ committed: false, version: 4, state });
  expect(save).not.toHaveBeenCalled();
});
