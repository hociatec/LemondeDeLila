"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _archedemnemosyneservice = require("../arche-de-mnemosyne.service");
function makeService() {
    const store = {
        listCategories: ()=>[
                {
                    id: 'c1',
                    name: 'Catégorie 1'
                },
                {
                    id: 'c2',
                    name: 'Catégorie 2'
                }
            ],
        listQuestions: ()=>[
                {
                    id: 'q1',
                    categoryId: 'c1',
                    question: 'Q1 ? ',
                    correct: 'A',
                    wrong1: 'B',
                    wrong2: 'C',
                    wrong3: 'D',
                    status: 'validated'
                }
            ]
    };
    const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
        register: jest.fn()
    }, {
        appendLog: (state, message)=>({
                ...state,
                log: [
                    ...Array.isArray(state.log) ? state.log : [],
                    {
                        message
                    }
                ]
            })
    }, {
        advanceTurn: (state)=>state
    }, store, {
        pickIndex: (_meta, _len)=>({
                index: 0,
                meta: {}
            }),
        shuffle: (meta, values)=>({
                meta,
                values: [
                    ...values
                ]
            })
    });
    return {
        service,
        store
    };
}
function makeBaseState() {
    return {
        status: 'open',
        phase: 'lobby',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'BotOwner',
                isBot: true
            },
            {
                id: 2,
                username: 'Player'
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            roomOwnerId: 1
        },
        pending: null,
        botThinking: false
    };
}
describe('ArcheDeMnemosyneService helper branches', ()=>{
    it('syncs bot pending states for setup/play/question branches', ()=>{
        const { service } = makeService();
        const hydrated = service.hydrateInitialState(makeBaseState());
        const meta = hydrated.metadata;
        const withPrompt = {
            ...hydrated,
            phase: 'setup',
            pending: null,
            metadata: {
                ...meta,
                prompt: {
                    type: 'config_prompt',
                    title: 'Config',
                    actionType: 'mnemo_set_config',
                    cancelActionType: 'mnemo_prompt_cancel',
                    fields: []
                },
                promptOwnerId: 1
            }
        };
        const setupPromptPending = service.syncBotPending(withPrompt);
        expect(setupPromptPending.pending).toEqual({
            type: 'mnemo_set_config',
            playerId: 1,
            blocking: true
        });
        const setupStart = {
            ...withPrompt,
            metadata: {
                ...withPrompt.metadata,
                prompt: null,
                promptOwnerId: null
            }
        };
        const setupStartPending = service.syncBotPending(setupStart);
        expect(setupStartPending.pending).toEqual({
            type: 'mnemo_start',
            playerId: 1,
            blocking: true
        });
        const playDraw = {
            ...setupStart,
            phase: 'play',
            metadata: {
                ...setupStart.metadata,
                currentQuestion: null,
                interQuestionUntilMs: null
            }
        };
        const playDrawPending = service.syncBotPending(playDraw);
        expect(playDrawPending.pending).toEqual({
            type: 'draw',
            playerId: 1,
            blocking: true
        });
        const playQuiz = {
            ...playDraw,
            metadata: {
                ...playDraw.metadata,
                currentQuestion: {
                    id: 'q1',
                    categoryId: 'c1',
                    question: 'Q1 ?',
                    choices: [
                        'A',
                        'B',
                        'C',
                        'D'
                    ],
                    correctChoice: 'A'
                },
                quizAnswersByPlayerId: {}
            },
            pending: null
        };
        const playQuizPending = service.syncBotPending(playQuiz);
        expect(playQuizPending.pending).toEqual({
            type: 'quiz',
            playerId: 1,
            blocking: true
        });
    });
    it('builds pending/actions for prompt, setup and play states', ()=>{
        const { service } = makeService();
        const hydrated = service.hydrateInitialState(makeBaseState());
        const promptState = {
            ...hydrated,
            phase: 'setup',
            metadata: {
                ...hydrated.metadata,
                adminView: {
                    page: 'setup'
                },
                prompt: {
                    type: 'text_prompt',
                    title: 'Ajouter',
                    label: 'Nom',
                    actionType: 'mnemo_add_category',
                    payloadKey: 'name',
                    cancelActionType: 'mnemo_prompt_cancel',
                    initialText: 'demo'
                },
                promptOwnerId: 1
            }
        };
        const pendingForOwner = service.buildPendingForUser(promptState, 1);
        expect(pendingForOwner).toEqual({
            type: 'text_prompt',
            playerId: 1,
            label: 'Nom',
            data: {
                title: 'Ajouter',
                actionType: 'mnemo_add_category',
                payloadKey: 'name',
                initialText: 'demo',
                cancelActionType: 'mnemo_prompt_cancel'
            }
        });
        const ownerActions = service.buildActionsForUser(promptState, 1);
        expect(ownerActions).toEqual([
            {
                type: 'mnemo_add_category',
                payload: {}
            },
            {
                type: 'mnemo_prompt_cancel',
                payload: {}
            }
        ]);
        const nonOwnerSetupActions = service.buildActionsForUser(promptState, 2);
        expect(nonOwnerSetupActions).toEqual([]);
        const playState = {
            ...promptState,
            phase: 'play',
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: {
                ...promptState.metadata,
                prompt: null,
                promptOwnerId: null,
                currentQuestion: null,
                interQuestionUntilMs: null
            }
        };
        const drawActions = service.buildActionsForUser(playState, 1);
        expect(drawActions).toEqual([
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const waitingState = {
            ...playState,
            metadata: {
                ...playState.metadata,
                interQuestionUntilMs: Date.now() + 2000
            }
        };
        expect(service.buildPendingForUser(waitingState, 1)).toBeNull();
    });
    it('covers helper utilities and default metadata guards', ()=>{
        const { service } = makeService();
        expect(service.parseBool('on', false)).toBe(true);
        expect(service.parseBool('off', true)).toBe(false);
        expect(service.parseBool('unknown', true)).toBe(true);
        expect(service.normalizeStatus('validated')).toBe('validated');
        expect(service.normalizeStatus('to_edit')).toBe('to_edit');
        expect(service.normalizeStatus('trash')).toBe('trash');
        expect(service.normalizeStatus('invalid')).toBe('pending');
        expect(service.statusLabel('all')).toBe('toutes');
        expect(service.statusLabel('validated')).toBe('validée');
        expect(service.statusLabel('to_edit')).toBe('à modifier');
        expect(service.statusLabel('something')).toBe('something');
        expect(service.back({
            page: 'categories'
        })).toEqual({
            page: 'setup'
        });
        expect(service.back({
            page: 'questions',
            categoryId: 'c1',
            status: 'pending'
        })).toEqual({
            page: 'category',
            categoryId: 'c1'
        });
        const guardedMeta = service.getMeta({
            metadata: {}
        });
        expect(guardedMeta.adminView).toEqual({
            page: 'setup'
        });
        expect(guardedMeta.config).toMatchObject({
            targetPoints: 20,
            timerSeconds: 30,
            interQuestionSeconds: 15
        });
    });
});
