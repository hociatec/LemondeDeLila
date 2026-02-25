"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _lesmainsdelaterreactionservice = require("../actions/les-mains-de-la-terre-action.service");
describe('LesMainsActionService draw behavior', ()=>{
    const makeService = ()=>{
        const core = new _gamecoreservice.GameCoreService();
        const random = new _randomservice.RandomService();
        const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
        return new _lesmainsdelaterreactionservice.LesMainsActionService(core, new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(core)), random, deckPolicies);
    };
    it('draws first card from deck', ()=>{
        const service = makeService();
        const out = service.drawOneCard({
            deck: [
                'a',
                'b'
            ],
            discard: [],
            rng: {
                seed: 1,
                counter: 0
            }
        });
        expect(out.cardId).toBe('a');
        expect(out.meta.deck).toEqual([
            'b'
        ]);
        expect(out.meta.discard).toEqual([]);
    });
    it('reshuffles discard when deck is empty', ()=>{
        const service = makeService();
        const out = service.drawOneCard({
            deck: [],
            discard: [
                'x',
                'y'
            ],
            rng: {
                seed: 3,
                counter: 0
            }
        });
        expect(out.cardId).not.toBeNull();
        expect(Array.isArray(out.meta.deck)).toBe(true);
        expect(out.meta.discard).toEqual([]);
    });
});
