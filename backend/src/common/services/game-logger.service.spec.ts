import { Test, TestingModule } from '@nestjs/testing';
import { GameLoggerService } from './game-logger.service';
import { GameError, GameValidationError } from '../errors/game-errors';

describe('GameLoggerService', () => {
  let service: GameLoggerService;
  let mockLogger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameLoggerService],
    }).compile();

    service = module.get<GameLoggerService>(GameLoggerService);

    // Mock the underlying Winston logger
    mockLogger = service.getLogger();
    jest.spyOn(mockLogger, 'error').mockImplementation();
    jest.spyOn(mockLogger, 'warn').mockImplementation();
    jest.spyOn(mockLogger, 'info').mockImplementation();
    jest.spyOn(mockLogger, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('error', () => {
    it('should log an error message with context', () => {
      service.error('Test error message', undefined, { roomId: 123, gameType: 'test-game' });

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Test error message',
        context: { roomId: 123, gameType: 'test-game' },
      });
    });

    it('should log a GameError with full context', () => {
      const gameError = new GameError(
        'Game error occurred',
        { roomId: 123, gameType: 'test-game' },
        'high'
      );

      service.error('Error logging test', gameError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error logging test',
          context: {},
          error: expect.objectContaining({
            name: 'GameError',
            message: 'Game error occurred',
            severity: 'high',
            context: { roomId: 123, gameType: 'test-game' },
            stack: expect.any(String),
          }),
        })
      );
    });

    it('should log a standard Error', () => {
      const error = new Error('Standard error');

      service.error('Standard error test', error, { roomId: 456 });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Standard error test',
          context: { roomId: 456 },
          error: expect.objectContaining({
            name: 'Error',
            message: 'Standard error',
            stack: expect.any(String),
          }),
        })
      );
    });
  });

  describe('warn', () => {
    it('should log a warning message with context', () => {
      service.warn('Warning message', { roomId: 789, gameType: 'test-game' });

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Warning message',
        context: { roomId: 789, gameType: 'test-game' },
      });
    });

    it('should log a warning without context', () => {
      service.warn('Simple warning');

      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Simple warning',
        context: {},
      });
    });
  });

  describe('info', () => {
    it('should log an info message with context', () => {
      service.info('Info message', { roomId: 100, turnIndex: 5 });

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Info message',
        context: { roomId: 100, turnIndex: 5 },
      });
    });
  });

  describe('debug', () => {
    it('should log a debug message with context', () => {
      service.debug('Debug message', { playerId: 42 });

      expect(mockLogger.debug).toHaveBeenCalledWith({
        message: 'Debug message',
        context: { playerId: 42 },
      });
    });
  });

  describe('logPlayerAction', () => {
    it('should log a player action with timestamp', () => {
      const action = {
        type: 'draw_card',
        payload: { deckId: 'main' },
      };
      const context = {
        roomId: 123,
        gameType: 'test-game',
        playerId: 5,
        turnIndex: 10,
      };

      service.logPlayerAction(action, context);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Player action',
          context: expect.objectContaining({
            roomId: 123,
            gameType: 'test-game',
            playerId: 5,
            turnIndex: 10,
            action: expect.objectContaining({
              type: 'draw_card',
              payload: { deckId: 'main' },
              timestamp: expect.any(String),
            }),
          }),
        })
      );
    });
  });

  describe('logStateChange', () => {
    it('should log game state changes', () => {
      const changes = {
        turnIndex: 5,
        currentPlayerId: 42,
      };

      service.logStateChange('Turn advanced', changes, {
        roomId: 123,
        gameType: 'test-game',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Game state change',
          context: expect.objectContaining({
            roomId: 123,
            gameType: 'test-game',
            description: 'Turn advanced',
            changes: {
              turnIndex: 5,
              currentPlayerId: 42,
            },
          }),
        })
      );
    });
  });

  describe('logValidationFailure', () => {
    it('should log validation failures with errors', () => {
      const validationErrors = [
        { field: 'type', message: 'Type is required' },
        { field: 'payload', message: 'Payload is invalid' },
      ];

      service.logValidationFailure(
        'Action validation failed',
        validationErrors,
        { roomId: 123, playerId: 5 }
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failure',
          context: expect.objectContaining({
            roomId: 123,
            playerId: 5,
            validationErrors,
            message: 'Action validation failed',
          }),
        })
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log low severity security events as warnings', () => {
      service.logSecurityEvent('Suspicious action detected', 'low', {
        roomId: 123,
        playerId: 5,
      });

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log high severity security events as errors', () => {
      service.logSecurityEvent('Potential exploit attempt', 'high', {
        roomId: 123,
        playerId: 5,
      });

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should log critical severity security events as errors', () => {
      service.logSecurityEvent('Critical security breach', 'critical', {
        roomId: 123,
        playerId: 5,
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('logPerformance', () => {
    it('should log performance metrics', () => {
      service.logPerformance('applyActions', 123.45, {
        roomId: 123,
        gameType: 'test-game',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Performance metric',
          context: expect.objectContaining({
            roomId: 123,
            gameType: 'test-game',
            operation: 'applyActions',
            durationMs: 123.45,
          }),
        })
      );
    });
  });

  describe('getLogger', () => {
    it('should return the underlying Winston logger', () => {
      const logger = service.getLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });
});
