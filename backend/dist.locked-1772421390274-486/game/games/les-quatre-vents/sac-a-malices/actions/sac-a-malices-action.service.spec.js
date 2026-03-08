"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _sacamalicesactionservice = require("./sac-a-malices-action.service");
describe('SacAMalicesActionService draw deck behavior', ()=>{
    const makeService = ()=>{
        const random = new _randomservice.RandomService();
        const core = new _gamecoreservice.GameCoreService();
        const setup = {};
        const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
        return new _sacamalicesactionservice.SacAMalicesActionService(random, core, setup, deckPolicies);
    };
    it('keeps get-out-of-jail card out of discard', ()=>{
        const service = makeService();
        const meta = {
            seed: 11,
            counter: 0,
            decks: {
                chance: {
                    cards: [
                        {
                            id: 1,
                            text: 'Carte sortie de prison',
                            title: 'Sortie'
                        }
                    ],
                    discard: []
                }
            }
        };
        const out = service.drawCard(meta, 'chance');
        expect(out.card?.id).toBe(1);
        expect(out.meta.decks.chance.cards).toEqual([]);
        expect(out.meta.decks.chance.discard).toEqual([]);
    });
    it('puts normal drawn card in discard', ()=>{
        const service = makeService();
        const meta = {
            seed: 21,
            counter: 0,
            decks: {
                chance: {
                    cards: [
                        {
                            id: 2,
                            text: 'Payez 50 euros',
                            title: 'Amende'
                        }
                    ],
                    discard: []
                }
            }
        };
        const out = service.drawCard(meta, 'chance');
        expect(out.card?.id).toBe(2);
        expect(out.meta.decks.chance.cards).toEqual([]);
        expect(out.meta.decks.chance.discard.map((c)=>c.id)).toEqual([
            2
        ]);
    });
});
