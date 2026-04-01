"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _jeuoieactionservice = require("../actions/jeu-oie-action.service");
const _jeuoiesetupservice = require("../setup/jeu-oie-setup.service");
function baseState() {
    return {
        status: 'started',
        phase: 'turn',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'Otis',
                isBot: true
            },
            {
                id: 2,
                username: 'Wallace',
                isBot: true
            },
            {
                id: 3,
                username: 'Lilas',
                isBot: false
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            gameType: 'jeu-oie',
            roomStartedAt: '2026-02-13T00:00:00.000Z',
            roomRunId: 1,
            rng: {
                seed: 123,
                counter: 0
            }
        }
    };
}
describe('JeuOieActionService', ()=>{
    it('utilise un pion immersif et evite le doublon du label de case', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _gamecontentloaderservice.GameContentLoaderService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (s)=>s
                    }
                },
                _jeuoiesetupservice.JeuOieSetupService,
                {
                    provide: _jeuoieactionservice.JeuOieActionService,
                    useFactory: (random, core, turns, setupFlow)=>new _jeuoieactionservice.JeuOieActionService(random, turns, core, setupFlow),
                    inject: [
                        _randomservice.RandomService,
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_jeuoiesetupservice.JeuOieSetupService);
        const actions = moduleRef.get(_jeuoieactionservice.JeuOieActionService);
        const random = moduleRef.get(_randomservice.RandomService);
        let state = setup.hydrateInitialState(baseState());
        state = actions.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'coq-rockeur'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'vache-artistique'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'cochon-gourmand'
                }
            }
        ]);
        state = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                pawnByPlayerId: {
                    1: 'coq-rockeur',
                    2: 'vache-artistique',
                    3: 'cochon-gourmand'
                }
            }
        };
        state = {
            ...state,
            pending: null,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            turnIndex: 0,
            log: []
        };
        jest.spyOn(random, 'rollDice').mockReturnValue({
            roll: 3,
            dice: [
                3
            ],
            meta: state.metadata ?? {}
        });
        const next = actions.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((e)=>String(e?.message ?? ''));
        expect(messages.some((m)=>m.includes('Otis place "son coq rockeur" en case 4 (Case neutre).'))).toBe(true);
        expect(messages.some((m)=>m.includes('case 4 (Case 4 - Case neutre)'))).toBe(false);
    });
    it('demande de choisir son pion via le pending label au demarrage', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _gamecontentloaderservice.GameContentLoaderService,
                _setupflowservice.SetupFlowService,
                _jeuoiesetupservice.JeuOieSetupService
            ]
        }).compile();
        const setup = moduleRef.get(_jeuoiesetupservice.JeuOieSetupService);
        const state = setup.hydrateInitialState(baseState());
        const meta = state.metadata ?? {};
        expect(meta.pawnByPlayerId?.[1]).toBeUndefined();
        expect(meta.pawnByPlayerId?.[2]).toBeUndefined();
        expect(meta.pawnByPlayerId?.[3]).toBeUndefined();
        expect(state.pending?.type).toBe('choose_pawn');
        const starterId = Number(meta.setupStarterId);
        expect(state.pending?.playerId).toBe(starterId);
        const starterName = state.players?.find((p)=>p?.id === starterId)?.username ?? `Joueur ${starterId}`;
        const pendingLabel = String(state.pending?.label ?? '');
        expect(pendingLabel.includes(`${starterName} de choisir son pion.`)).toBe(true);
    });
    it('demarre la partie apres le choix de pion de tous les joueurs', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _gamecontentloaderservice.GameContentLoaderService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (s)=>s
                    }
                },
                _jeuoiesetupservice.JeuOieSetupService,
                {
                    provide: _jeuoieactionservice.JeuOieActionService,
                    useFactory: (random, core, turns, setupFlow)=>new _jeuoieactionservice.JeuOieActionService(random, turns, core, setupFlow),
                    inject: [
                        _randomservice.RandomService,
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_jeuoiesetupservice.JeuOieSetupService);
        const actions = moduleRef.get(_jeuoieactionservice.JeuOieActionService);
        const state = setup.hydrateInitialState(baseState());
        const next = actions.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'coq-rockeur'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'vache-artistique'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'cochon-gourmand'
                }
            }
        ]);
        const meta = next.metadata ?? {};
        expect(next.pending).toBeNull();
        const assigned = Object.values(meta.pawnByPlayerId ?? {});
        expect(assigned).toHaveLength(3);
        expect(new Set(assigned).size).toBe(3);
        const messages = (next.log ?? []).map((e)=>String(e?.message ?? ''));
        const starterId = Number(meta.setupStarterId);
        const starterName = next.players?.find((p)=>p?.id === starterId)?.username ?? `Joueur ${starterId}`;
        expect(messages.some((m)=>m.includes(starterName) && m.includes('commence.') && (m.includes('Début de partie') || m.includes('Début de partie')))).toBe(true);
    });
});
