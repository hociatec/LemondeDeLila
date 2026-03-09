"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _archedemnemosyneservice = require("../arche-de-mnemosyne.service");
describe('ArcheDeMnemosyneService prompt actions', ()=>{
    it('exposes prompt actionType so engine can accept submissions', ()=>{
        const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s)=>s
        }, {}, {
            listCategories: ()=>[],
            listQuestions: ()=>[]
        }, {});
        const base = {
            status: 'open',
            phase: 'lobby',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'hacene'
                }
            ],
            metadata: {}
        };
        const state = service.hydrateInitialState(base);
        const available = service.getAvailableActions(state, 1).map((a)=>a.type);
        expect(available).toContain('mnemo_set_config');
        expect(available).toContain('mnemo_prompt_cancel');
    });
    it('prevents bot from starting until setup config is validated, then allows it', ()=>{
        const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s)=>s
        }, {}, {
            listCategories: ()=>[
                    {
                        id: 'c1',
                        name: 'Cat 1'
                    }
                ],
            listQuestions: ()=>[]
        }, {});
        const base = {
            status: 'open',
            phase: 'lobby',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: -1,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Owner'
                }
            ],
            metadata: {
                roomOwnerId: 1
            }
        };
        const state = service.hydrateInitialState(base);
        const botAvailableBefore = service.getAvailableActions(state, -1);
        expect(botAvailableBefore.length).toBe(0);
        const config = service.validateAction(state, {
            type: 'mnemo_set_config',
            payload: {
                useTimer: 'oui',
                timerSeconds: 30,
                targetPoints: 20
            }
        }, 1);
        const afterConfig = service.applyActions(state, [
            {
                ...config,
                meta: {
                    actorId: 1
                }
            }
        ]);
        const ownerAvailableAfter = service.getAvailableActions(afterConfig, 1).map((a)=>a.type);
        expect(ownerAvailableAfter).toContain('mnemo_start');
        expect(()=>service.validateAction(afterConfig, {
                type: 'mnemo_start',
                payload: {
                    categoryId: null
                }
            }, -1)).not.toThrow();
    });
    it('shows setup config prompt to room owner even if a bot is first in players[]', ()=>{
        const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s)=>s
        }, {}, {
            listCategories: ()=>[],
            listQuestions: ()=>[]
        }, {});
        const base = {
            status: 'open',
            phase: 'lobby',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 99,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Owner'
                }
            ],
            metadata: {
                roomOwnerId: 1
            }
        };
        const state = service.hydrateInitialState(base);
        const exposed = service.exposeStateForUser(state, 1);
        expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
        expect(String(exposed?.pending?.data?.actionType ?? '')).toBe('mnemo_set_config');
    });
    it('makes bots answer randomly for each question', ()=>{
        const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s)=>s
        }, {}, {
            listCategories: ()=>[],
            listQuestions: ()=>[]
        }, {});
        const state = {
            status: 'started',
            phase: 'quiz',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Owner'
                },
                {
                    id: -1,
                    username: 'Bot A',
                    isBot: true
                },
                {
                    id: -2,
                    username: 'Bot B',
                    isBot: true
                }
            ],
            metadata: {
                roomRunId: 7,
                quizDeadlineAtMs: 123,
                currentQuestion: {
                    id: 'q1',
                    categoryId: 'c1',
                    question: 'Q?',
                    choices: [
                        'A',
                        'B',
                        'C',
                        'D'
                    ],
                    correctChoice: 'A'
                },
                quizAnswersByPlayerId: {},
                adminView: {
                    page: 'setup'
                }
            }
        };
        const a = service.getBotActions({
            ...state,
            turn: {
                currentPlayerId: -1,
                direction: 1
            }
        }, -1);
        const b = service.getBotActions({
            ...state,
            turn: {
                currentPlayerId: -2,
                direction: 1
            }
        }, -2);
        expect(Array.isArray(a)).toBe(true);
        expect(Array.isArray(b)).toBe(true);
        expect(a?.[0]?.type).toBe('answer_quiz');
        expect(b?.[0]?.type).toBe('answer_quiz');
        expect(Number.isFinite(Number(a?.[0]?.payload?.answerIndex))).toBe(true);
        expect(Number.isFinite(Number(b?.[0]?.payload?.answerIndex))).toBe(true);
        expect(Number((a?.[0]).payload.answerIndex)).toBeGreaterThanOrEqual(0);
        expect(Number((a?.[0]).payload.answerIndex)).toBeLessThan(4);
        expect(Number((b?.[0]).payload.answerIndex)).toBeGreaterThanOrEqual(0);
        expect(Number((b?.[0]).payload.answerIndex)).toBeLessThan(4);
    });
    it('exposes a stable label for quiz choices (a11y)', ()=>{
        const service = new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s)=>s
        }, {}, {
            listCategories: ()=>[],
            listQuestions: ()=>[]
        }, {});
        const state = {
            status: 'started',
            phase: 'quiz',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Owner'
                }
            ],
            metadata: {
                roomOwnerId: 1,
                currentQuestion: {
                    id: 'q1',
                    categoryId: 'c1',
                    question: 'Question ?',
                    choices: [
                        'A',
                        'B',
                        'C',
                        'D'
                    ],
                    correctChoice: 'A'
                },
                quizAnswersByPlayerId: {},
                adminView: {
                    page: 'setup'
                }
            }
        };
        const exposed = service.exposeStateForUser(state, 1);
        expect(String(exposed?.pending?.type ?? '')).toBe('quiz');
        expect(String(exposed?.pending?.label ?? '')).toBe('Réponses possibles');
    });
});
