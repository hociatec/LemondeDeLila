"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _common = require("@nestjs/common");
const _gameengineservice = require("../services/game-engine.service");
jest.mock('winston', ()=>({
        createLogger: ()=>({
                error: jest.fn(),
                warn: jest.fn(),
                info: jest.fn(),
                debug: jest.fn(),
                log: jest.fn()
            }),
        format: {
            combine: (...args)=>args,
            timestamp: jest.fn(()=>jest.fn()),
            errors: jest.fn(()=>jest.fn()),
            json: jest.fn(()=>jest.fn()),
            colorize: jest.fn(()=>jest.fn()),
            printf: jest.fn(()=>jest.fn())
        },
        transports: {
            Console: jest.fn(),
            File: jest.fn()
        }
    }), {
    virtual: true
});
describe('GameEngineService', ()=>{
    it('returns a fallback turn message on T even when panels are missing', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {
            getHandler: jest.fn(()=>({}))
        }, {}, {}, {}, {}, {}, {}, {}, {});
        engine.getStateForUser = jest.fn().mockResolvedValue({
            status: 'started',
            players: [
                {
                    id: 1,
                    username: 'Lila'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            extras: {},
            log: []
        });
        const out = await engine.handleKeyPress(1, 'any', 1, 'T');
        expect(out).toEqual({
            kind: 'panel',
            panelId: 'turn',
            message: 'À toi de jouer.'
        });
    });
    it('returns fallback score/hand panel messages from extras when ui.panels are missing', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {
            getHandler: jest.fn(()=>({}))
        }, {}, {}, {}, {}, {}, {}, {}, {});
        engine.getStateForUser = jest.fn().mockResolvedValue({
            status: 'started',
            players: [
                {
                    id: 1,
                    username: 'Lila'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            extras: {
                hand: [
                    '1',
                    'LAMA'
                ],
                score: [
                    'Total jetons: 4',
                    'Lila: 4'
                ]
            },
            log: []
        });
        const score = await engine.handleKeyPress(1, 'any', 1, 'S');
        const hand = await engine.handleKeyPress(1, 'any', 1, 'E');
        expect(score).toEqual({
            kind: 'panel',
            panelId: 'score',
            message: 'Score : Total jetons: 4 | Lila: 4.'
        });
        expect(hand).toEqual({
            kind: 'panel',
            panelId: 'hands',
            message: 'Main : 1, LAMA.'
        });
    });
    it('does not replay stale skip-turn announcements on subsequent actions', async ()=>{
        const startedAt = '2026-02-09T00:00:00.000Z';
        const players = [
            {
                id: 1,
                username: 'hacene',
                isBot: false
            },
            {
                id: 2,
                username: 'Polynesia',
                isBot: false
            }
        ];
        let stateRef = {
            status: 'started',
            turnIndex: 0,
            players,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                gameType: 'frousse-party',
                roomId: 1,
                roomStartedAt: startedAt,
                statuses: {
                    skipTurn: {}
                },
                turnFlow: {
                    skipped: [
                        {
                            id: 2,
                            remainingBefore: 1,
                            remainingAfter: 0
                        }
                    ]
                }
            },
            log: [],
            extras: {}
        };
        const rooms = {
            getRoomPayload: jest.fn().mockResolvedValue({
                room: {
                    id: 1,
                    gameType: 'frousse-party',
                    status: 'started',
                    startedAt,
                    players,
                    bots: []
                }
            }),
            resetRoomSystem: jest.fn(),
            notifyRoomStateUpdated: jest.fn()
        };
        const core = {
            buildBaseState: jest.fn(),
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state?.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const store = {
            buildKey: jest.fn(()=>'1:frousse-party'),
            delete: jest.fn().mockResolvedValue(undefined),
            get: jest.fn(async ()=>stateRef),
            set: jest.fn(async (_roomId, _gameType, next)=>{
                stateRef = next;
            }),
            markBotThinking: jest.fn((state)=>state),
            syncRoomStatus: jest.fn((state)=>state)
        };
        let actionTick = 0;
        const handler = {
            getAvailableActions: jest.fn(()=>[
                    {
                        type: 'roll',
                        payload: {}
                    }
                ]),
            validateAction: jest.fn((_state, action)=>action),
            applyActions: jest.fn(async (state)=>core.appendLog(state, `action-${++actionTick}`))
        };
        const botScheduler = {
            clear: jest.fn(),
            has: jest.fn(()=>false),
            schedule: jest.fn()
        };
        const gameLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            logPlayerAction: jest.fn(),
            logValidationFailure: jest.fn()
        };
        const engine = new _gameengineservice.GameEngineService(rooms, core, {
            getHandler: jest.fn(()=>handler)
        }, {
            compute: jest.fn(()=>null)
        }, {}, botScheduler, {
            getBotTurnDelayMs: jest.fn(()=>0)
        }, {
            attachGridRenderDescriptors: jest.fn((s)=>s)
        }, store, gameLogger, {
            finalizeFinished: jest.fn()
        });
        const first = await engine.applyActions(1, 'frousse-party', [
            {
                type: 'roll',
                payload: {}
            }
        ], 1, false);
        const second = await engine.applyActions(1, 'frousse-party', [
            {
                type: 'roll',
                payload: {}
            }
        ], 1, false);
        const firstMessages = (first.log ?? []).map((e)=>String(e?.message ?? ''));
        const secondMessages = (second.log ?? []).map((e)=>String(e?.message ?? ''));
        expect(firstMessages.at(-1)).toBe('Polynesia passe son tour.');
        expect(secondMessages.at(-1)).toBe('action-2');
        expect(stateRef.metadata?.turnFlow?.skipped ?? []).toEqual([]);
    });
    it('silently ignores unavailable draw action (even with payload)', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const state = {
            metadata: {
                gameType: 'frousse-party',
                roomId: 1
            }
        };
        const handler = {
            getAvailableActions: jest.fn(()=>[
                    {
                        type: 'roll',
                        payload: {}
                    }
                ])
        };
        const out = await engine.validateActions(state, handler, [
            {
                type: 'draw',
                payload: {
                    deck: 'any'
                }
            }
        ], 1);
        expect(out).toEqual([]);
    });
    it('silently ignores unavailable actions when actor is out of turn', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const state = {
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            metadata: {
                gameType: 'frousse-party',
                roomId: 1
            }
        };
        const handler = {
            getAvailableActions: jest.fn(()=>[
                    {
                        type: 'roll',
                        payload: {}
                    }
                ])
        };
        const out = await engine.validateActions(state, handler, [
            {
                type: 'play_card',
                payload: {
                    cardId: 'x'
                }
            }
        ], 1);
        expect(out).toEqual([]);
    });
    it('rejects unavailable action when actor is in turn (pending blocker scenario)', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {
            set: jest.fn()
        }, {
            logValidationFailure: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
        }, {});
        const state = {
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: {
                gameType: 'frousse-party',
                roomId: 1
            }
        };
        const handler = {
            getAvailableActions: jest.fn(()=>[
                    {
                        type: 'draw',
                        payload: {}
                    }
                ])
        };
        await expect(engine.validateActions(state, handler, [
            {
                type: 'play_card',
                payload: {
                    cardId: 'x'
                }
            }
        ], 1)).rejects.toBeInstanceOf(_common.BadRequestException);
    });
    it('silently ignores game validation errors for out-of-turn messages', async ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const state = {
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {
                gameType: 'frousse-party',
                roomId: 1
            }
        };
        const handler = {
            getAvailableActions: jest.fn(()=>[
                    {
                        type: 'play_card',
                        payload: {}
                    }
                ]),
            validateAction: jest.fn(()=>{
                throw new Error("Ce n'est pas votre tour.");
            })
        };
        const out = await engine.validateActions(state, handler, [
            {
                type: 'play_card',
                payload: {
                    cardId: 'x'
                }
            }
        ], 1);
        expect(out).toEqual([]);
    });
    it('returns current state (no error) when a player acts out of turn', async ()=>{
        const current = {
            status: 'started',
            turnIndex: 0,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A',
                    isBot: false
                },
                {
                    id: 2,
                    username: 'B',
                    isBot: false
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {
                gameType: 'frousse-party',
                roomId: 1
            }
        };
        const engine = new _gameengineservice.GameEngineService({}, {}, {
            getHandler: jest.fn(()=>({
                    getAvailableActions: jest.fn(()=>[]),
                    validateActor: jest.fn(()=>false)
                }))
        }, {}, {}, {}, {}, {}, {}, {}, {});
        engine.getInternalState = jest.fn(async ()=>current);
        engine.normalizeBotThinking = jest.fn(async ()=>current);
        engine.exposeState = jest.fn(()=>current);
        const out = await engine.applyActionsInternal(1, 'frousse-party', [
            {
                type: 'roll',
                payload: {}
            }
        ], 2, false);
        expect(out).toBe(current);
        expect(engine.exposeState).toHaveBeenCalledWith(current, 'frousse-party');
    });
    it('does not mark botThinking when a blocking pending action targets a human', async ()=>{
        const state = {
            status: 'started',
            turnIndex: 0,
            players: [
                {
                    id: -1,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Lilas',
                    isBot: false
                }
            ],
            turn: {
                currentPlayerId: -1,
                direction: 1
            },
            pending: {
                type: 'choose_pawn',
                playerId: 1,
                blocking: true
            },
            metadata: {}
        };
        const store = {
            markBotThinking: jest.fn((s, botThinking)=>({
                    ...s,
                    botThinking
                })),
            set: jest.fn().mockResolvedValue(undefined)
        };
        const handler = {
            getAvailableActions: jest.fn((s, playerId)=>playerId === 1 && s.pending?.type === 'choose_pawn' ? [
                    {
                        type: 'choose_pawn',
                        payload: {
                            pawnId: 'x'
                        }
                    }
                ] : [])
        };
        const engine = new _gameengineservice.GameEngineService({}, {}, {
            getHandler: jest.fn(()=>handler)
        }, {}, {}, {}, {}, {}, store, {}, {});
        const marked = await engine.markBotThinking(1, 'frousse-party', state, true);
        expect(store.markBotThinking).toHaveBeenCalledWith(state, false);
        expect(marked.botThinking).toBe(false);
    });
    it('rejects gameType mismatches for a room', async ()=>{
        const rooms = {
            getRoomPayload: jest.fn().mockResolvedValue({
                room: {
                    gameType: 'corridor'
                }
            })
        };
        const botScheduler = {
            clear: jest.fn()
        };
        const store = {
            buildKey: jest.fn(()=>'1:generic'),
            delete: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
            markBotThinking: jest.fn((state)=>state),
            syncRoomStatus: jest.fn((_state)=>_state)
        };
        const gameLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            logPlayerAction: jest.fn(),
            logValidationFailure: jest.fn()
        };
        const engine = new _gameengineservice.GameEngineService(rooms, {}, {}, {}, {}, botScheduler, {}, {}, store, gameLogger, {});
        let err;
        try {
            await engine.getState(1, 'generic');
        } catch (e) {
            err = e;
        }
        if (!(err instanceof _common.BadRequestException)) {
            throw err;
        }
        expect(botScheduler.clear).toHaveBeenCalled();
        expect(store.delete).toHaveBeenCalled();
    });
    it('auto-resets a stale finished game when the room is still started', async ()=>{
        const rooms = {
            getRoomPayload: jest.fn().mockResolvedValueOnce({
                room: {
                    id: 1,
                    gameType: 'corridor',
                    status: 'started',
                    startedAt: new Date().toISOString()
                }
            }).mockResolvedValueOnce({
                room: {
                    id: 1,
                    gameType: 'corridor',
                    status: 'setup',
                    startedAt: null
                }
            }),
            resetRoomSystem: jest.fn().mockResolvedValue({
                id: 1,
                status: 'setup',
                startedAt: null
            }),
            notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined)
        };
        const store = {
            buildKey: jest.fn(()=>'1:corridor'),
            delete: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue({
                status: 'finished',
                turnIndex: 1,
                players: [],
                turn: {
                    currentPlayerId: null,
                    direction: 1
                },
                metadata: {
                    roomStartedAt: new Date().toISOString()
                }
            }),
            set: jest.fn().mockResolvedValue(undefined),
            markBotThinking: jest.fn((state)=>state),
            syncRoomStatus: jest.fn((state)=>state)
        };
        const core = {
            buildBaseState: jest.fn(()=>({
                    status: 'setup',
                    turnIndex: 0,
                    players: [],
                    turn: {
                        currentPlayerId: null,
                        direction: 1
                    },
                    metadata: {},
                    log: [],
                    extras: {}
                })),
            appendLog: jest.fn((state)=>state)
        };
        const botScheduler = {
            clear: jest.fn(),
            has: jest.fn(()=>false),
            schedule: jest.fn()
        };
        const gameLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            logPlayerAction: jest.fn(),
            logValidationFailure: jest.fn()
        };
        const engine = new _gameengineservice.GameEngineService(rooms, core, {
            getHandler: jest.fn(()=>null)
        }, {
            compute: jest.fn(()=>null)
        }, {}, botScheduler, {
            getBotTurnDelayMs: jest.fn(()=>0)
        }, {
            attachGridRenderDescriptors: jest.fn((s)=>s)
        }, store, gameLogger, {
            finalizeFinished: jest.fn()
        });
        await engine.getInternalState(1, 'corridor');
        expect(rooms.resetRoomSystem).toHaveBeenCalledWith(1);
        expect(rooms.notifyRoomStateUpdated).toHaveBeenCalledWith(1);
        expect(store.delete).toHaveBeenCalledWith(1, 'corridor');
    });
    it('keeps a freshly finished game state during grace window before auto-reset', async ()=>{
        const now = new Date().toISOString();
        const rooms = {
            getRoomPayload: jest.fn().mockResolvedValue({
                room: {
                    id: 1,
                    gameType: 'corridor',
                    status: 'started',
                    startedAt: now
                }
            }),
            resetRoomSystem: jest.fn(),
            notifyRoomStateUpdated: jest.fn()
        };
        const store = {
            buildKey: jest.fn(()=>'1:corridor'),
            delete: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue({
                status: 'finished',
                turnIndex: 1,
                players: [],
                turn: {
                    currentPlayerId: null,
                    direction: 1
                },
                metadata: {
                    roomStartedAt: now,
                    finishedAt: now,
                    winnerId: 1
                }
            }),
            set: jest.fn().mockResolvedValue(undefined),
            markBotThinking: jest.fn((state)=>state),
            syncRoomStatus: jest.fn((state)=>state)
        };
        const botScheduler = {
            clear: jest.fn(),
            has: jest.fn(()=>false),
            schedule: jest.fn()
        };
        const gameLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            logPlayerAction: jest.fn(),
            logValidationFailure: jest.fn()
        };
        const engine = new _gameengineservice.GameEngineService(rooms, {}, {
            getHandler: jest.fn(()=>null)
        }, {
            compute: jest.fn(()=>null)
        }, {}, botScheduler, {
            getBotTurnDelayMs: jest.fn(()=>0)
        }, {
            attachGridRenderDescriptors: jest.fn((s)=>s)
        }, store, gameLogger, {
            finalizeFinished: jest.fn()
        });
        const state = await engine.getInternalState(1, 'corridor');
        expect(state.status).toBe('finished');
        expect(rooms.resetRoomSystem).not.toHaveBeenCalled();
        expect(store.delete).not.toHaveBeenCalled();
        expect(botScheduler.schedule).toHaveBeenCalledWith(expect.objectContaining({
            key: '1:corridor:finished-reset',
            delayMs: 5000,
            roomId: 1,
            gameType: 'corridor'
        }));
    });
    it('keeps negative-id room bots when syncing a started roster', ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const state = {
            status: 'started',
            turnIndex: 4,
            players: [
                {
                    id: 1,
                    username: 'Hacene',
                    isBot: false
                },
                {
                    id: -7,
                    username: 'Idéfix',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: -7,
                direction: 1
            },
            metadata: {},
            log: [],
            extras: {}
        };
        const payload = {
            room: {
                players: [
                    {
                        id: 1,
                        username: 'Hacene'
                    }
                ],
                bots: [
                    {
                        id: 7,
                        name: 'Idéfix'
                    }
                ]
            }
        };
        const next = engine.syncRosterForStartedRoom(state, payload);
        const bot = (next.players ?? []).find((p)=>p?.id === -7);
        expect(bot).toBeDefined();
        expect(bot?.isBot).toBe(true);
        expect(next.turn?.currentPlayerId).toBe(-7);
    });
    it('keeps negative-id room bots by id even when bot name changed', ()=>{
        const engine = new _gameengineservice.GameEngineService({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
        const state = {
            status: 'started',
            turnIndex: 8,
            players: [
                {
                    id: 1,
                    username: 'Hacene',
                    isBot: false
                },
                {
                    id: -11,
                    username: 'Idefix',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: -11,
                direction: 1
            },
            metadata: {},
            log: [],
            extras: {}
        };
        const payload = {
            room: {
                players: [
                    {
                        id: 1,
                        username: 'Hacene'
                    }
                ],
                bots: [
                    {
                        id: 11,
                        name: 'Idéfix'
                    }
                ]
            }
        };
        const next = engine.syncRosterForStartedRoom(state, payload);
        const bot = (next.players ?? []).find((p)=>p?.id === -11);
        expect(bot).toBeDefined();
        expect(bot?.isBot).toBe(true);
        expect(next.turn?.currentPlayerId).toBe(-11);
    });
});
