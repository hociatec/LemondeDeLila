"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lamatestharness = require("./lama-test-harness");
describe('LamaService', ()=>{
    it('does not assign setup ownership to a bot (prefers first human)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Human'
                }
            ],
            log: [],
            metadata: {}
        });
        expect(Number(state?.metadata?.ownerPlayerId ?? 0)).toBe(1);
        expect(Number(state?.turn?.currentPlayerId ?? 0)).toBe(1);
        const exposedHuman = service.exposeStateForUser(state, 1);
        const exposedBot = service.exposeStateForUser(state, 2);
        expect(exposedHuman.pending).not.toBeNull();
        expect(Number(exposedHuman.pending?.playerId ?? 0)).toBe(1);
        expect(exposedBot.pending).toBeNull();
    });
    it('ignores roomOwnerId if it points to a bot (still prefers a human owner)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Human'
                }
            ],
            log: [],
            metadata: {
                roomOwnerId: 2
            }
        });
        expect(Number(state?.metadata?.ownerPlayerId ?? 0)).toBe(1);
        expect(Number(state?.turn?.currentPlayerId ?? 0)).toBe(1);
    });
    it('exposes pending choices only for current player', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            log: [],
            metadata: {}
        });
        const exposedA = service.exposeStateForUser(state, 1);
        const exposedB = service.exposeStateForUser(state, 2);
        expect(exposedA.pending).not.toBeNull();
        expect(Number(exposedA.pending?.playerId ?? 0)).toBe(1);
        expect(exposedB.pending).toBeNull();
    });
    it('starts with a single setup prompt, then starts the first round', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Owner'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            log: [],
            metadata: {}
        });
        expect(String(state.status)).toBe('started');
        expect(String(state.phase)).toBe('setup');
        expect(Boolean(state?.pending?.blocking)).toBe(true);
        const exposed = service.exposeStateForUser(state, 1);
        expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
        expect((exposed?.actions ?? []).some((a)=>a?.type === 'lama_set_config')).toBe(true);
        const started = service.applyActions(state, [
            {
                type: 'lama_set_config',
                payload: {
                    loseAtScore: 40,
                    roundPauseSeconds: 2,
                    allowPlayAfterDraw: 'true'
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(String(started.phase)).toBe('round');
        expect(Number(started.metadata?.roundPauseSeconds ?? -1)).toBe(2);
        expect(Number(started.metadata?.loseAtScore ?? 0)).toBe(40);
        expect(Boolean(started.metadata?.allowPlayAfterDraw)).toBe(false);
        expect((started.metadata?.discard ?? []).length).toBeGreaterThan(0);
    });
    it('suggests a bot action on its turn', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    1
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '2': [
                        1,
                        1
                    ]
                },
                droppedOutByPlayerId: {
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const actions = service.getBotActions(state, 2);
        expect(actions.length).toBeGreaterThan(0);
        expect([
            'lama_play',
            'draw',
            'lama_quit',
            'lama_return'
        ]).toContain(actions[0].type);
    });
    it('declares keyboard shortcuts', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const shortcuts = service.getShortcuts({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(shortcuts.some((s)=>s?.type === 'interface' && s?.id === 'discard')).toBe(true);
        expect(shortcuts.some((s)=>s?.type === 'interface' && s?.id === 'hands')).toBe(true);
        expect(shortcuts.some((s)=>s?.type === 'interface' && s?.id === 'score')).toBe(true);
        expect(shortcuts.some((s)=>s?.type === 'action' && s?.actionType === 'lama_quit')).toBe(true);
    });
    it('prevents infinite bot draw loop when turnTracker is serialized as strings', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                allowPlayAfterDraw: true,
                step: 'turn_choice',
                deck: [
                    1,
                    2,
                    3,
                    4
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '2': [
                        5,
                        6
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                // Simule une sérialisation "string" (cause typique de mismatch strict).
                turnTracker: {
                    playerId: '2',
                    drawn: 'true',
                    played: 'false'
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                roundNumber: 1,
                roundStarterIndex: 0,
                winnerId: null
            }
        };
        // Le bot ne doit pas re-piocher indéfiniment : il doit se retirer de la manche après avoir déjà pioché.
        const actions = service.getBotActions(state, 2);
        expect(actions.length).toBe(1);
        expect(actions[0].type).toBe('lama_quit');
    });
    it('prevents multiple consecutive draws even if turnTracker becomes desynced', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                step: 'turn_choice',
                allowPlayAfterDraw: true,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    1,
                    7
                ],
                discard: [
                    6
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        1,
                        2,
                        3,
                        4,
                        5
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                turnTracker: {
                    playerId: 2,
                    drawn: false,
                    played: false
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const afterFirst = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        expect(afterFirst.turn.currentPlayerId).toBe(1);
        const deckAfterFirst = (afterFirst.metadata.deck ?? []).length;
        const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? []).length;
        // Simule un bug externe: tracker du tour ne correspond plus au joueur courant.
        const desynced = {
            ...afterFirst,
            metadata: {
                ...afterFirst.metadata,
                turnTracker: {
                    playerId: 1,
                    drawn: false,
                    played: false
                }
            }
        };
        const afterSecond = service.applyActions(desynced, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        // La 2e pioche doit être ignorée (même si turnTracker est incohérent).
        expect((afterSecond.metadata.deck ?? []).length).toBe(deckAfterFirst);
        expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(handAfterFirst);
        const messages = (afterSecond.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.filter((m)=>(m ?? '').startsWith('Bot pioche ')).length).toBe(1);
    });
    it('includes discard top in pending label', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [],
                discard: [
                    6
                ],
                handsByPlayerId: {
                    '1': [
                        7
                    ],
                    '2': []
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const exposed = service.exposeStateForUser(state, 1);
        const label = String(exposed?.pending?.label ?? '');
        expect(label).toContain('Défausse');
        expect(label).toContain('6');
    });
    it('logs every player action (for NVDA announcements)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const base = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 1
            },
            metadata: {
                step: 'turn_choice',
                allowPlayAfterDraw: false,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    2,
                    3,
                    4
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        1
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                turnTracker: {
                    playerId: 1,
                    drawn: false,
                    played: false
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        // draw
        const afterDraw = service.applyActions(base, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterDraw.log.length).toBeGreaterThan(base.log.length);
        const drawMessages = afterDraw.log.slice(base.log.length).map((l)=>String(l?.message ?? ''));
        expect(drawMessages.some((m)=>m.includes('pioche'))).toBe(true);
        // play
        const afterPlay = service.applyActions(base, [
            {
                type: 'lama_play',
                payload: {
                    value: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterPlay.log.length).toBeGreaterThan(base.log.length);
        const playMessages = afterPlay.log.slice(base.log.length).map((l)=>String(l?.message ?? ''));
        expect(playMessages.some((m)=>m.includes('joue'))).toBe(true);
        // quit
        const afterQuit = service.applyActions(base, [
            {
                type: 'lama_quit',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterQuit.log.length).toBeGreaterThan(base.log.length);
        const quitMessages = afterQuit.log.slice(base.log.length).map((l)=>String(l?.message ?? ''));
        expect(quitMessages.some((m)=>m.includes('se retire'))).toBe(true);
        expect(quitMessages.some((m)=>m.includes('ne jouera plus'))).toBe(true);
        // peek discard (info action)
        const afterPeek = service.applyActions(base, [
            {
                type: 'lama_peek_discard',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterPeek.log.length).toBeGreaterThan(base.log.length);
        const peekMessages = afterPeek.log.slice(base.log.length).map((l)=>String(l?.message ?? ''));
        expect(peekMessages.some((m)=>m.includes('défausse'))).toBe(true);
        // pass alias (official rule = leave round)
        const passState = {
            ...base,
            metadata: {
                ...base.metadata,
                allowPlayAfterDraw: true,
                turnTracker: {
                    playerId: 1,
                    drawn: true,
                    played: false
                }
            }
        };
        const afterPass = service.applyActions(passState, [
            {
                type: 'lama_pass',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterPass.log.length).toBeGreaterThan(passState.log.length);
        const passMessages = afterPass.log.slice(passState.log.length).map((l)=>String(l?.message ?? ''));
        expect(passMessages.some((m)=>m.includes('se retire'))).toBe(true);
        // return token (requires return_token step)
        const returnState = {
            ...base,
            metadata: {
                ...base.metadata,
                step: 'return_token',
                pendingReturnQueue: [
                    1
                ],
                pendingReturnPlayerId: 1,
                scoresByPlayerId: {
                    '1': 10,
                    '2': 0
                }
            },
            pending: {
                step: 'return_token',
                playerId: 1
            }
        };
        const afterReturn = service.applyActions(returnState, [
            {
                type: 'lama_return',
                payload: {
                    value: 10
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterReturn.log.length).toBeGreaterThan(returnState.log.length);
        const returnMessages = afterReturn.log.slice(returnState.log.length).map((l)=>String(l?.message ?? ''));
        expect(returnMessages.some((m)=>m.includes('diamant'))).toBe(true);
    });
    it('logs "doit piocher" before a bot draw (no double draw)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                step: 'turn_choice',
                allowPlayAfterDraw: true,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    2,
                    3,
                    4
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        5,
                        6
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                turnTracker: {
                    playerId: 2,
                    drawn: false,
                    played: false
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        const messages = (after.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m.includes('doit piocher'))).toBe(true);
        expect(messages.filter((m)=>(m ?? '').startsWith('Bot pioche ')).length).toBe(1);
    });
    it('redacts drawn card labels in the log for opponents (only the drawer sees the card)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            log: [
                {
                    message: 'A pioche un 5.'
                },
                {
                    message: 'B pioche un LAMA.'
                },
                {
                    message: 'B passe.'
                }
            ],
            metadata: {
                step: 'turn_choice',
                allowPlayAfterDraw: false,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    2,
                    3,
                    4
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        1
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                turnTracker: {
                    playerId: 1,
                    drawn: false,
                    played: false
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const exposedA = service.exposeStateForUser(state, 1);
        const exposedB = service.exposeStateForUser(state, 2);
        const messagesA = (exposedA.log ?? []).map((l)=>String(l?.message ?? ''));
        const messagesB = (exposedB.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messagesA).toContain('A pioche un 5.');
        expect(messagesA).toContain('B pioche une carte.');
        expect(messagesA).not.toContain('B pioche un LAMA.');
        expect(messagesB).toContain('B pioche un LAMA.');
        expect(messagesB).toContain('A pioche une carte.');
        expect(messagesB).not.toContain('A pioche un 5.');
    });
    it('prevents a bot from drawing multiple times while still on its turn', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                step: 'turn_choice',
                allowPlayAfterDraw: true,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    1,
                    7
                ],
                discard: [
                    6
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2,
                        3,
                        4,
                        5,
                        6
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                turnTracker: {
                    playerId: 2,
                    drawn: false,
                    played: false
                },
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const afterFirst = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        expect(afterFirst.turn.currentPlayerId).toBe(1);
        expect(Boolean(afterFirst.metadata?.turnTracker?.drawn)).toBe(false);
        const deckAfterFirst = (afterFirst.metadata.deck ?? []).length;
        const handAfterFirst = (afterFirst.metadata.handsByPlayerId?.['2'] ?? []).length;
        const afterSecond = service.applyActions(afterFirst, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        // Second draw is ignored (one draw per turn).
        expect((afterSecond.metadata.deck ?? []).length).toBe(deckAfterFirst);
        expect((afterSecond.metadata.handsByPlayerId?.['2'] ?? []).length).toBe(handAfterFirst);
        const messages = (afterSecond.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.filter((m)=>(m ?? '').startsWith('Bot pioche ')).length).toBe(1);
    });
    it('offers only single-card plays in pending choices', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1,
                        1,
                        1
                    ],
                    '2': []
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const exposed = service.exposeStateForUser(state, 1);
        const choices = exposed?.pending?.choices ?? [];
        expect(choices).toEqual([
            '1',
            '1',
            '1'
        ]);
        const playActions = (exposed?.actions ?? []).filter((a)=>a?.type === 'lama_play');
        expect(playActions.length).toBe(3);
        expect(playActions.every((a)=>Number(a?.payload?.count ?? 0) === 1)).toBe(true);
    });
    it('does not offer draw/quit in pending choices (draw is via SPACE)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1,
                        2
                    ],
                    '2': []
                },
                droppedOutByPlayerId: {},
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const exposed = service.exposeStateForUser(state, 1);
        const choices = (exposed?.pending?.choices ?? []).map((c)=>String(c));
        // The hand list contains only cards.
        expect(choices.every((c)=>[
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                'LAMA'
            ].includes(c))).toBe(true);
        const actionTypes = (exposed?.actions ?? []).map((a)=>String(a?.type ?? '').toLowerCase());
        expect(actionTypes).toContain('draw');
        expect(actionTypes).toContain('lama_quit');
    });
    it('passes the turn after a draw', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6,
                    5
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(after.turn.currentPlayerId).toBe(2);
        expect((after.metadata.deck ?? []).length).toBe(1);
        expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
    });
    it('blocks draw after at least one player has quit the round', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 5,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6,
                    5
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        2
                    ],
                    '2': [
                        3
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': true
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const exposed = service.exposeStateForUser(state, 1);
        const actionTypes = (exposed?.actions ?? []).map((a)=>String(a?.type ?? '').toLowerCase());
        expect(actionTypes).not.toContain('draw');
        const after = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(after.turnIndex).toBe(state.turnIndex);
        expect((after.metadata?.deck ?? []).length).toBe((state.metadata?.deck ?? []).length);
        expect((after.metadata?.handsByPlayerId?.['1'] ?? []).length).toBe((state.metadata?.handsByPlayerId?.['1'] ?? []).length);
    });
    it('passes the turn after a draw even when allowPlayAfterDraw is configured', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                allowPlayAfterDraw: true,
                turnTracker: {
                    playerId: 1,
                    drawn: false,
                    played: false
                },
                deck: [
                    6,
                    5
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(after.turn.currentPlayerId).toBe(2);
        expect((after.metadata.deck ?? []).length).toBe(1);
        expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
        expect(Boolean(after.metadata?.turnTracker?.drawn)).toBe(false);
        const exposed = service.exposeStateForUser(after, 1);
        const actionTypes = (exposed?.actions ?? []).map((a)=>String(a?.type ?? '').toLowerCase());
        // Turn has passed to next player.
        expect(actionTypes).not.toContain('draw');
        expect(actionTypes).not.toContain('lama_play');
        expect(actionTypes).toContain('lama_quit');
    });
    it('does not allow multiple draws in a single message from the same actor', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6,
                    5
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            },
            {
                type: 'draw',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        // Only the first draw applies; second is rejected because it's no longer actor 1's turn.
        expect((after.metadata.deck ?? []).length).toBe(1);
        expect((after.metadata.handsByPlayerId?.['1'] ?? []).length).toBe(2);
        expect(after.turn.currentPlayerId).toBe(2);
    });
    it('passes the turn after playing', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6,
                    5
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1,
                        2
                    ],
                    '2': [
                        2
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'lama_play',
                payload: {
                    value: 1,
                    count: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(after.turn.currentPlayerId).toBe(2);
    });
    it('scores only distinct remaining card values at end of round', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        3,
                        3,
                        4,
                        4,
                        7
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'lama_play',
                payload: {
                    value: 1,
                    count: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        // B keeps 3,4,LAMA => 3+4+10 = 17 (duplicates ignored).
        expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(17);
        // Winner has 0 token, so there is nothing to return: auto-advance to next round.
        expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(0);
    });
    it('enters a round pause instead of starting the next round immediately (when configured)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 10,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 100,
                roundPauseSeconds: 2,
                roundPauseUntilMs: null,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [
                    6
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'return_token',
                pendingReturnQueue: [
                    1
                ],
                pendingReturnPlayerId: 1,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'lama_return',
                payload: {
                    value: 0
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(String(after.metadata?.step ?? '')).toBe('round_pause');
        expect(Number(after.round ?? 0)).toBe(2);
        expect(typeof after.metadata?.roundPauseUntilMs).toBe('number');
    });
    it('does not score/end the same round twice (idempotent endRound)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const endedState = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 10,
            lastRoll: null,
            log: [
                {
                    message: 'Fin de la manche 1.'
                },
                {
                    message: 'Lilas prend 12 jetons (pénalité).'
                },
                {
                    message: 'Grosminet gagne la manche.'
                }
            ],
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Grosminet'
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundPauseSeconds: 0,
                roundPauseUntilMs: null,
                roundNumber: 1,
                roundStarterIndex: 0,
                endedRoundNumber: 1,
                deck: [
                    1
                ],
                discard: [
                    6
                ],
                handsByPlayerId: {
                    '1': [
                        1,
                        2
                    ],
                    '2': [
                        5
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 12,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(endedState, [
            {
                type: 'lama_quit',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        // No duplicate "Fin de la manche" or extra penalties.
        const messages = (after.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.filter((m)=>m === 'Fin de la manche 1.').length).toBe(1);
        expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(12);
    });
    it('reconciles endRound when log already contains round end (no duplicate messages)', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const state = {
            status: 'started',
            phase: 'round',
            round: 3,
            turnIndex: 10,
            lastRoll: null,
            log: [
                {
                    message: 'Fin de la manche 3.'
                },
                {
                    message: 'Lilas prend 17 jetons (pénalité).'
                },
                {
                    message: 'Casper gagne la manche.'
                }
            ],
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Casper'
                }
            ],
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 2
            },
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundPauseSeconds: 2,
                roundPauseUntilMs: null,
                roundNumber: 3,
                roundStarterIndex: 0,
                endedRoundNumber: null,
                deck: [
                    1
                ],
                discard: [
                    6
                ],
                handsByPlayerId: {
                    '1': [
                        1,
                        2
                    ],
                    '2': [
                        6
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 17,
                    '2': 1
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        // Trigger endRound through a normal action; the service must not append another "Fin de la manche 3."
        // and must reconcile the pending "return_token" for the winner.
        const after = service.applyActions(state, [
            {
                type: 'lama_quit',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        const messages = (after.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.filter((m)=>m === 'Fin de la manche 3.').length).toBe(1);
        expect(String(after.metadata?.step ?? '')).toBe('return_token');
        expect(Number(after.metadata?.endedRoundNumber ?? 0)).toBe(3);
    });
    it('auto-skips return_token when winner has 0 token', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const base = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Winner'
                },
                {
                    id: 2,
                    username: 'Loser'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 1
            },
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundPauseSeconds: 0,
                roundPauseUntilMs: null,
                roundNumber: 1,
                roundStarterIndex: 0,
                endedRoundNumber: null,
                deck: [
                    1
                ],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2,
                        3,
                        7
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 0,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(base, [
            {
                type: 'lama_play',
                payload: {
                    value: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        // Loser gets penalty, Winner stays at 0 => no return_token prompt should happen.
        expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(2 + 3 + 10);
        expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(0);
        expect(Number(after.metadata?.pendingReturnPlayerId ?? 0)).toBe(0);
        const messages = (after.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m.includes("n'a rien à rendre"))).toBe(true);
    });
    it('n’invite pas au retour de jetons après la première manche', async ()=>{
        const { service } = (0, _lamatestharness.createLamaServiceForTest)();
        const base = {
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Winner'
                },
                {
                    id: 2,
                    username: 'Loser'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: {
                step: 'turn_choice',
                playerId: 1
            },
            metadata: {
                ownerPlayerId: 1,
                loseAtScore: 40,
                roundPauseSeconds: 0,
                roundPauseUntilMs: null,
                roundNumber: 1,
                roundStarterIndex: 0,
                deck: [],
                discard: [
                    1
                ],
                handsByPlayerId: {
                    '1': [
                        1
                    ],
                    '2': [
                        2,
                        3,
                        7
                    ]
                },
                droppedOutByPlayerId: {
                    '1': false,
                    '2': false
                },
                scoresByPlayerId: {
                    '1': 5,
                    '2': 0
                },
                step: 'turn_choice',
                pendingReturnQueue: [],
                pendingReturnPlayerId: null,
                winnerId: null
            }
        };
        const after = service.applyActions(base, [
            {
                type: 'lama_play',
                payload: {
                    value: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(Number(after.metadata?.scoresByPlayerId?.['2'] ?? 0)).toBe(2 + 3 + 10);
        expect(Number(after.metadata?.scoresByPlayerId?.['1'] ?? 0)).toBe(5);
        expect(String(after.metadata?.step ?? '')).toBe('turn_choice');
        expect(after.metadata?.pendingReturnPlayerId).toBeNull();
    });
});
