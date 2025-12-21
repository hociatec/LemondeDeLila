import { BadRequestException } from '@nestjs/common';
import { GameEngineService } from '../services/game-engine.service';

describe('GameEngineService', () => {
  it('rejects gameType mismatches for a room', async () => {
    const rooms = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: { gameType: 'loup-garou' },
      }),
    };
    const botScheduler = { clear: jest.fn() };
    const store = { buildKey: jest.fn(() => '1:generic'), delete: jest.fn() };

    const engine = new GameEngineService(
      rooms as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      botScheduler as any,
      store as any,
    );

    let err: unknown;
    try {
      await engine.getState(1, 'generic');
    } catch (e) {
      err = e;
    }
    if (!(err instanceof BadRequestException)) {
      throw err;
    }
    expect(botScheduler.clear).toHaveBeenCalled();
    expect(store.delete).toHaveBeenCalled();
  });
});
