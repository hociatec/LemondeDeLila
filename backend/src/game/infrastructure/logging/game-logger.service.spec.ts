import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { GameError } from '../../domain/errors/game-errors';
import { GameLoggerService } from './game-logger.service';

describe('GameLoggerService', () => {
  let service: GameLoggerService;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  const configMock = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'LOG_FILES_ENABLED') return false;
      if (key === 'LOG_LEVEL') return 'info';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    configMock.get.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameLoggerService,
        {
          provide: ConfigService,
          useValue: configMock,
        },
      ],
    }).compile();

    service = module.get<GameLoggerService>(GameLoggerService);
    const logger = service.getLogger();
    errorSpy = jest.spyOn(logger, 'error').mockImplementation();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    infoSpy = jest.spyOn(logger, 'info').mockImplementation();
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs an error message with context', () => {
    service.error('Test error message', undefined, {
      roomId: 123,
      gameType: 'test-game',
    });

    expect(errorSpy).toHaveBeenCalledWith({
      message: 'Test error message',
      context: { roomId: 123, gameType: 'test-game' },
    });
  });

  it('logs a GameError with full context', () => {
    const gameError = new GameError(
      'Game error occurred',
      { roomId: 123, gameType: 'test-game', timestamp: new Date() },
      'high',
    );

    service.error('Error logging test', gameError);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error logging test',
      }),
    );
  });

  it('logs warnings infos and debug messages', () => {
    service.warn('Warning message', { roomId: 789 });
    service.info('Info message', { roomId: 100 });
    service.debug('Debug message', { playerId: 42 });

    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();
  });
});
