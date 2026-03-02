"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _contesetcacahuetessetupservice = require("../setup/contes-et-cacahuetes-setup.service");
const _contesactionservice = require("../actions/contes-action.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function toText(value) {
    return typeof value === 'string' ? value : '';
}
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
                username: 'Lilas',
                isBot: false
            },
            {
                id: 2,
                username: 'Bucky',
                isBot: true
            },
            {
                id: 3,
                username: 'Otis',
                isBot: false
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            gameType: 'contes-et-cacahuetes',
            rng: {
                seed: 1234,
                counter: 0
            }
        },
        botThinking: false
    };
}
describe('Contes pawn selection', ()=>{
    it('selects first chooser randomly among all participants and completes setup', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _contesetcacahuetessetupservice.ContesCacahuetesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>state
                    }
                },
                {
                    provide: _contesactionservice.ContesActionService,
                    useFactory: (core, random, turns, setupFlow, deckPolicies)=>new _contesactionservice.ContesActionService(core, random, turns, setupFlow, deckPolicies),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        _randomservice.RandomService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_contesetcacahuetessetupservice.ContesCacahuetesSetupService);
        const actionsService = moduleRef.get(_contesactionservice.ContesActionService);
        let state = setup.hydrateInitialState(baseState());
        const pending0 = asRecord(state.pending);
        const pendingData = asRecord(pending0.data);
        const firstPawns = Array.isArray(pendingData.pawns) ? pendingData.pawns : [];
        expect(toText(pending0.type)).toBe('choose_pawn');
        expect(firstPawns.length).toBeGreaterThan(0);
        const firstPawn = asRecord(firstPawns[0]);
        expect(typeof firstPawn.description).toBe('string');
        expect(toText(firstPawn.description).trim().length).toBeGreaterThan(0);
        const metadata = asRecord(state.metadata);
        const starterId = Number(metadata.setupStarterId ?? 0);
        expect([
            1,
            2,
            3
        ]).toContain(starterId);
        expect(Number(pending0.playerId)).toBe(starterId);
        let safety = 0;
        while(toText(asRecord(state.pending).type) === 'choose_pawn' && safety < 10){
            const pending = asRecord(state.pending);
            const pid = Number(pending.playerId ?? 0);
            const available = _rulebook.getAvailableActions(state, pid);
            expect(available.length).toBeGreaterThan(0);
            expect(available.every((action)=>action.type === 'choose_pawn')).toBe(true);
            const firstAction = available[0];
            const toApply = [
                firstAction
            ];
            state = actionsService.applyActions(state, toApply);
            safety += 1;
        }
        expect(state.pending ?? null).toBeNull();
        expect(safety).toBe(3);
        expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(starterId);
    });
});
