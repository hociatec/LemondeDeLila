import { BadRequestException } from '@nestjs/common';
import { GameEngineService } from '../services/game-engine.service';

jest.mock(
  'winston',
  () => ({
    createLogger: () => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    }),
    format: {
      combine: (...args: any[]) => args,
      timestamp: jest.fn(() => jest.fn()),
      errors: jest.fn(() => jest.fn()),
      json: jest.fn(() => jest.fn()),
      colorize: jest.fn(() => jest.fn()),
      printf: jest.fn(() => jest.fn()),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  }),
  { virtual: true },
);

describe('GameEngineService', () => {
  it('rejects gameType mismatches for a room', async () => {
    const rooms = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: { gameType: 'loup-garou' },
      }),
    };
    const botScheduler = { clear: jest.fn() };
    const store = {
      buildKey: jest.fn(() => '1:generic'),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      markBotThinking: jest.fn((state: any) => state),
      syncRoomStatus: jest.fn((_state: any) => _state),
    };
    const gameLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      logPlayerAction: jest.fn(),
      logValidationFailure: jest.fn(),
    };

    const engine = new GameEngineService(
      rooms as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      botScheduler as any,
      store as any,
      gameLogger as any,
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
