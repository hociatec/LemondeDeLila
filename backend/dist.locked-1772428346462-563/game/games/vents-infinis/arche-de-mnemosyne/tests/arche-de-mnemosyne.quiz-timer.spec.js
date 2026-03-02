"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _archedemnemosyneservice = require("../arche-de-mnemosyne.service");
describe('ArcheDeMnemosyneService quiz timer', ()=>{
    const makeService = (questions = [])=>new _archedemnemosyneservice.ArcheDeMnemosyneService({
            register: jest.fn()
        }, {
            appendLog: (s, m)=>({
                    ...s,
                    log: [
                        ...Array.isArray(s.log) ? s.log : [],
                        {
                            message: m
                        }
                    ]
                })
        }, {
            advanceTurn: (s)=>s
        }, {
            listCategories: ()=>[
                    {
                        id: 'c1',
                        name: 'Cat'
                    }
                ],
            listQuestions: ()=>questions
        }, {
            pickIndex: (_meta, len)=>({
                    index: Math.max(0, Math.min(len - 1, 0)),
                    meta: {}
                }),
            shuffle: (_meta, arr)=>({
                    meta: {},
                    values: arr
                })
        });
    it('stops the quiz timer as soon as everyone answered (clears deadline)', ()=>{
        const service = makeService([
            {
                id: 'q2',
                categoryId: 'c1',
                question: 'Q2?',
                correct: 'A',
                wrong1: 'B',
                wrong2: 'C',
                wrong3: 'D',
                status: 'validated',
                createdAt: 'x',
                updatedAt: 'x'
            }
        ]);
        const state = {
            status: 'started',
            phase: 'play',
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
            metadata: {
                config: {
                    useTimer: true,
                    timerSeconds: 30,
                    targetPoints: 20,
                    correctSoloPoints: 2,
                    correctMultiPoints: 1,
                    wrongPoints: 0,
                    timeoutPoints: -1
                },
                quizDeadlineAtMs: Date.now() + 30_000,
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
                scoresByPlayerId: {
                    1: 0,
                    2: 0
                },
                selectedCategoryId: null,
                usedQuestionIds: [],
                adminView: {
                    page: 'setup'
                },
                prompt: null,
                winnerId: null
            }
        };
        const afterA = service.applyActions(state, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 0
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(afterA.metadata.currentQuestion).toBeTruthy();
        expect(afterA.metadata.quizDeadlineAtMs).toBeTruthy();
        const afterB = service.applyActions(afterA, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 1
                },
                meta: {
                    actorId: 2
                }
            }
        ]);
        const messages = (afterB.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m === 'A répond : Bonne réponse.')).toBe(true);
        expect(messages.some((m)=>m === 'B répond : Mauvaise réponse.')).toBe(true);
        expect(messages.some((m)=>m.includes('répond : A.'))).toBe(false);
        expect(messages.some((m)=>m.includes('répond : B.'))).toBe(false);
        expect(messages.some((m)=>m.includes('La bonne réponse était'))).toBe(true);
        expect(messages.some((m)=>m.includes('Prochaine question dans'))).toBe(true);
        expect(messages.some((m)=>m === 'Fin de la manche 1.')).toBe(true);
        expect(afterB.metadata.currentQuestion).toBeNull();
        expect(afterB.metadata.quizDeadlineAtMs).toBeNull();
        expect(typeof afterB.metadata.interQuestionUntilMs).toBe('number');
        expect(Object.keys(afterB.metadata.quizAnswersByPlayerId ?? {}).length).toBe(0);
        expect(afterB.round).toBe(2);
    });
    it('when nobody finds the answer: does not repeat it in the "Personne..." line', ()=>{
        const service = makeService();
        const state = {
            status: 'started',
            phase: 'play',
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
            metadata: {
                config: {
                    useTimer: true,
                    timerSeconds: 30,
                    targetPoints: 20,
                    correctSoloPoints: 2,
                    correctMultiPoints: 1,
                    wrongPoints: 0,
                    timeoutPoints: -1
                },
                quizDeadlineAtMs: Date.now() + 30_000,
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
                scoresByPlayerId: {
                    1: 0,
                    2: 0
                },
                selectedCategoryId: null,
                usedQuestionIds: [],
                adminView: {
                    page: 'setup'
                },
                prompt: null,
                winnerId: null
            }
        };
        const afterA = service.applyActions(state, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 1
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        const afterB = service.applyActions(afterA, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 2
                },
                meta: {
                    actorId: 2
                }
            }
        ]);
        const messages = (afterB.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m === `Personne n'a trouvé la bonne réponse.`)).toBe(true);
        expect(messages.some((m)=>m.includes(`Personne n'a trouvé la bonne réponse (`))).toBe(false);
        expect(messages.some((m)=>m.includes('La bonne réponse était'))).toBe(false);
    });
    it('when game ends: does not announce a next question countdown', ()=>{
        const service = makeService();
        const state = {
            status: 'started',
            phase: 'play',
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
            metadata: {
                config: {
                    useTimer: true,
                    timerSeconds: 30,
                    targetPoints: 1,
                    correctSoloPoints: 2,
                    correctMultiPoints: 1,
                    wrongPoints: 0,
                    timeoutPoints: -1
                },
                quizDeadlineAtMs: Date.now() + 30_000,
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
                scoresByPlayerId: {
                    1: 0,
                    2: 0
                },
                selectedCategoryId: null,
                usedQuestionIds: [],
                adminView: {
                    page: 'setup'
                },
                prompt: null,
                winnerId: null
            }
        };
        const afterA = service.applyActions(state, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 0
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        const afterB = service.applyActions(afterA, [
            {
                type: 'answer_quiz',
                payload: {
                    answerIndex: 1
                },
                meta: {
                    actorId: 2
                }
            }
        ]);
        expect(String(afterB.status ?? '')).toBe('finished');
        expect(afterB.metadata.interQuestionUntilMs).toBeNull();
        const messages = (afterB.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m.includes('Prochaine question dans 5 secondes'))).toBe(false);
        expect(messages.some((m)=>m === 'Fin de la manche 1.')).toBe(true);
    });
    it('on timeout: logs the correct answer and waits 5s before next question', ()=>{
        const service = makeService();
        const state = {
            status: 'started',
            phase: 'play',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            metadata: {
                config: {
                    useTimer: true,
                    timerSeconds: 1,
                    targetPoints: 20,
                    correctSoloPoints: 2,
                    correctMultiPoints: 1,
                    wrongPoints: 0,
                    timeoutPoints: -1
                },
                quizDeadlineAtMs: Date.now() - 1,
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
                quizAnswersByPlayerId: {
                    1: 1
                },
                scoresByPlayerId: {
                    1: 0,
                    2: 0
                },
                selectedCategoryId: null,
                usedQuestionIds: [],
                adminView: {
                    page: 'setup'
                },
                prompt: null,
                winnerId: null
            }
        };
        const after = service.applyActions(state, [
            {
                type: 'mnemo_timeout',
                payload: {},
                meta: {
                    actor: 'system'
                }
            }
        ]);
        const messages = (after.log ?? []).map((l)=>String(l?.message ?? ''));
        expect(messages.some((m)=>m === 'Lilas répond : Mauvaise réponse.')).toBe(true);
        expect(messages.some((m)=>m === 'Bot répond : Temps écoulé.')).toBe(true);
        expect(messages.some((m)=>m.includes('La bonne réponse était'))).toBe(false);
        expect(messages.some((m)=>m.includes('Prochaine question dans'))).toBe(true);
        expect(messages.some((m)=>m === 'Fin de la manche 1.')).toBe(true);
        expect(after.metadata.currentQuestion).toBeNull();
        expect(typeof after.metadata.interQuestionUntilMs).toBe('number');
        expect(after.round).toBe(2);
    });
});
