"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _config = require("@nestjs/config");
const _gameloggerservice = require("./game-logger.service");
const _gameerrors = require("../errors/game-errors");
describe('GameLoggerService', ()=>{
    let service;
    let errorSpy;
    let warnSpy;
    let infoSpy;
    let debugSpy;
    const configMock = {
        get: jest.fn((key, defaultValue)=>{
            if (key === 'LOG_FILES_ENABLED') return false;
            if (key === 'LOG_LEVEL') return 'info';
            return defaultValue;
        })
    };
    beforeEach(async ()=>{
        configMock.get.mockClear();
        const module = await _testing.Test.createTestingModule({
            providers: [
                _gameloggerservice.GameLoggerService,
                {
                    provide: _config.ConfigService,
                    useValue: configMock
                }
            ]
        }).compile();
        service = module.get(_gameloggerservice.GameLoggerService);
        // Mock the underlying Winston logger
        const logger = service.getLogger();
        errorSpy = jest.spyOn(logger, 'error').mockImplementation();
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        infoSpy = jest.spyOn(logger, 'info').mockImplementation();
        debugSpy = jest.spyOn(logger, 'debug').mockImplementation();
    });
    afterEach(()=>{
        jest.clearAllMocks();
    });
    it('should be defined', ()=>{
        expect(service).toBeDefined();
    });
    describe('error', ()=>{
        it('should log an error message with context', ()=>{
            service.error('Test error message', undefined, {
                roomId: 123,
                gameType: 'test-game'
            });
            expect(errorSpy).toHaveBeenCalledWith({
                message: 'Test error message',
                context: {
                    roomId: 123,
                    gameType: 'test-game'
                }
            });
        });
        it('should log a GameError with full context', ()=>{
            const gameError = new _gameerrors.GameError('Game error occurred', {
                roomId: 123,
                gameType: 'test-game',
                timestamp: new Date()
            }, 'high');
            service.error('Error logging test', gameError);
            expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error logging test',
                context: {},
                error: expect.objectContaining({
                    name: 'GameError',
                    message: 'Game error occurred',
                    severity: 'high',
                    context: expect.objectContaining({
                        roomId: 123,
                        gameType: 'test-game'
                    })
                })
            }));
        });
        it('should log a standard Error', ()=>{
            const error = new Error('Standard error');
            service.error('Standard error test', error, {
                roomId: 456
            });
            expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Standard error test',
                context: {
                    roomId: 456
                },
                error: expect.objectContaining({
                    name: 'Error',
                    message: 'Standard error'
                })
            }));
        });
    });
    describe('warn', ()=>{
        it('should log a warning message with context', ()=>{
            service.warn('Warning message', {
                roomId: 789,
                gameType: 'test-game'
            });
            expect(warnSpy).toHaveBeenCalledWith({
                message: 'Warning message',
                context: {
                    roomId: 789,
                    gameType: 'test-game'
                }
            });
        });
        it('should log a warning without context', ()=>{
            service.warn('Simple warning');
            expect(warnSpy).toHaveBeenCalledWith({
                message: 'Simple warning',
                context: {}
            });
        });
    });
    describe('info', ()=>{
        it('should log an info message with context', ()=>{
            service.info('Info message', {
                roomId: 100,
                turnIndex: 5
            });
            expect(infoSpy).toHaveBeenCalledWith({
                message: 'Info message',
                context: {
                    roomId: 100,
                    turnIndex: 5
                }
            });
        });
    });
    describe('debug', ()=>{
        it('should log a debug message with context', ()=>{
            service.debug('Debug message', {
                playerId: 42
            });
            expect(debugSpy).toHaveBeenCalledWith({
                message: 'Debug message',
                context: {
                    playerId: 42
                }
            });
        });
    });
    describe('logPlayerAction', ()=>{
        it('should log a player action with timestamp', ()=>{
            const action = {
                type: 'draw_card',
                payload: {
                    deckId: 'main'
                }
            };
            const context = {
                roomId: 123,
                gameType: 'test-game',
                playerId: 5,
                turnIndex: 10
            };
            service.logPlayerAction(action, context);
            expect(infoSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Player action',
                context: expect.objectContaining({
                    roomId: 123,
                    gameType: 'test-game',
                    playerId: 5,
                    turnIndex: 10,
                    action: expect.objectContaining({
                        type: 'draw_card',
                        payload: {
                            deckId: 'main'
                        }
                    })
                })
            }));
        });
    });
    describe('logStateChange', ()=>{
        it('should log game state changes', ()=>{
            const changes = {
                turnIndex: 5,
                currentPlayerId: 42
            };
            service.logStateChange('Turn advanced', changes, {
                roomId: 123,
                gameType: 'test-game'
            });
            expect(debugSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Game state change',
                context: expect.objectContaining({
                    roomId: 123,
                    gameType: 'test-game',
                    description: 'Turn advanced',
                    changes: {
                        turnIndex: 5,
                        currentPlayerId: 42
                    }
                })
            }));
        });
    });
    describe('logValidationFailure', ()=>{
        it('should log validation failures with errors', ()=>{
            const validationErrors = [
                {
                    field: 'type',
                    message: 'Type is required'
                },
                {
                    field: 'payload',
                    message: 'Payload is invalid'
                }
            ];
            service.logValidationFailure('Action validation failed', validationErrors, {
                roomId: 123,
                playerId: 5
            });
            expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Validation failure',
                context: expect.objectContaining({
                    roomId: 123,
                    playerId: 5,
                    validationErrors,
                    message: 'Action validation failed'
                })
            }));
        });
    });
    describe('logSecurityEvent', ()=>{
        it('should log low severity security events as warnings', ()=>{
            service.logSecurityEvent('Suspicious action detected', 'low', {
                roomId: 123,
                playerId: 5
            });
            expect(warnSpy).toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
        it('should log high severity security events as errors', ()=>{
            service.logSecurityEvent('Potential exploit attempt', 'high', {
                roomId: 123,
                playerId: 5
            });
            expect(errorSpy).toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
        });
        it('should log critical severity security events as errors', ()=>{
            service.logSecurityEvent('Critical security breach', 'critical', {
                roomId: 123,
                playerId: 5
            });
            expect(errorSpy).toHaveBeenCalled();
        });
    });
    describe('logPerformance', ()=>{
        it('should log performance metrics', ()=>{
            service.logPerformance('applyActions', 123.45, {
                roomId: 123,
                gameType: 'test-game'
            });
            expect(debugSpy).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Performance metric',
                context: expect.objectContaining({
                    roomId: 123,
                    gameType: 'test-game',
                    operation: 'applyActions',
                    durationMs: 123.45
                })
            }));
        });
    });
    describe('getLogger', ()=>{
        it('should return the underlying Winston logger', ()=>{
            const logger = service.getLogger();
            expect(logger).toBeDefined();
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });
    });
});
