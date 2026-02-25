"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _common = require("@nestjs/common");
const _setupflowservice = require("../../modules/setup-flow/services/setup-flow.service");
const _gridcellactionsservice = require("../../modules/grid/services/grid-cell-actions.service");
const _morpionpresenter = require("../../games/vents-sacres/morpion/morpion.presenter");
const _morpionservice = require("../../games/vents-sacres/morpion/morpion.service");
const _gameengineservice = require("../services/game-engine.service");
const registryStub = {
    register: ()=>undefined
};
const defaultPlayers = [
    {
        id: 1,
        username: 'A'
    },
    {
        id: 2,
        username: 'B'
    }
];
function clonePlayers() {
    return defaultPlayers.map((player)=>({
            ...player
        }));
}
function buildBaseState(overrides = {}) {
    return {
        status: 'setup',
        phase: 'setup',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        metadata: {},
        players: overrides.players ?? clonePlayers(),
        ...overrides
    };
}
const createMorpion = ()=>new _morpionservice.MorpionService(registryStub, new _morpionpresenter.MorpionPresenter(new _gridcellactionsservice.GridCellActionsService()));
function buildPlayAction(actorId, x, y) {
    return {
        type: 'morpion_play',
        payload: {
            x,
            y
        },
        meta: {
            actorId
        }
    };
}
function extractWinnerId(state) {
    const metadata = state.metadata;
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }
    const candidate = metadata.winnerId;
    return typeof candidate === 'number' ? candidate : null;
}
describe('Critical Cases Matrix', ()=>{
    it('debut de partie: hydrate un etat started avec un joueur courant', ()=>{
        const service = createMorpion();
        const state = service.hydrateInitialState(buildBaseState({
            status: 'setup'
        }));
        expect(state.status).toBe('started');
        expect(state.turn?.currentPlayerId).toBe(1);
    });
    it('choix pion: cree un pending bloquant avec playerId cible', ()=>{
        const setupFlow = new _setupflowservice.SetupFlowService();
        const out = setupFlow.createSequentialPawnPending({
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
            startPlayerId: 1,
            isAssigned: (id)=>id === 1,
            pawns: [
                {
                    id: 'chat',
                    label: 'Chat'
                },
                {
                    id: 'chien',
                    label: 'Chien'
                }
            ],
            pendingType: 'choose_pawn'
        });
        expect(out).not.toBeNull();
        expect(out?.pending.type).toBe('choose_pawn');
        expect(out?.pending.blocking).toBe(true);
        expect(out?.pending.playerId).toBe(2);
    });
    it('tour suivant: apres une action valide, le tour passe au joueur suivant', ()=>{
        const service = createMorpion();
        let state = service.hydrateInitialState(buildBaseState({
            status: 'started'
        }));
        state = service.applyActions(state, [
            buildPlayAction(1, 0, 0)
        ]);
        expect(state.turn?.currentPlayerId).toBe(2);
    });
    it('victoire: une ligne gagnante termine la partie avec winnerId', ()=>{
        const service = createMorpion();
        let state = service.hydrateInitialState(buildBaseState({
            status: 'started'
        }));
        const plays = [
            buildPlayAction(1, 0, 0),
            buildPlayAction(2, 0, 1),
            buildPlayAction(1, 1, 0),
            buildPlayAction(2, 1, 1),
            buildPlayAction(1, 2, 0)
        ];
        for (const action of plays){
            state = service.applyActions(state, [
                action
            ]);
        }
        expect(state.status).toBe('finished');
        expect(extractWinnerId(state)).toBe(1);
    });
    it("erreurs d'action: une action indisponible est rejetee pour le joueur courant", async ()=>{
        const loggerStub = {
            logValidationFailure: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
        };
        const engine = Object.create(_gameengineservice.GameEngineService.prototype);
        const engineWithLogger = engine;
        engineWithLogger.gameLogger = loggerStub;
        const state = {
            ...buildBaseState({
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
                    gameType: 'morpion',
                    roomId: 1
                }
            })
        };
        const handler = {
            gameType: 'morpion',
            category: 'tests',
            displayName: 'Morpion',
            hydrateInitialState: (incoming)=>incoming,
            applyActions: (current)=>current,
            getAvailableActions: ()=>[
                    {
                        type: 'draw',
                        payload: {}
                    }
                ]
        };
        const validateActions = engine.validateActions;
        const invalidAction = {
            type: 'play_card',
            payload: {}
        };
        await expect(validateActions(state, handler, [
            invalidAction
        ], 1)).rejects.toBeInstanceOf(_common.BadRequestException);
    });
});
