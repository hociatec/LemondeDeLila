"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _panierexpressservice = require("../panier-express.service");
const _panierexpresstestharness = require("./panier-express-test-harness");
describe('PanierExpress scenario (smoke)', ()=>{
    it('rolls a few turns without crashing', async ()=>{
        const moduleRef = await (0, _panierexpresstestharness.createPanierExpressTestingModule)();
        const game = moduleRef.get(_panierexpressservice.PanierExpressService);
        let state = game.hydrateInitialState({
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
            status: 'started'
        });
        state.status = 'started';
        state.turn = {
            currentPlayerId: 1,
            direction: 1
        };
        state.turnIndex = 0;
        for(let i = 0; i < 10; i++){
            const currentId = state.turn?.currentPlayerId ?? null;
            if (typeof currentId !== 'number') break;
            const actions = game.getAvailableActions(state, currentId);
            const roll = actions.find((a)=>String(a.type).toLowerCase() === 'roll') ?? actions[0];
            if (!roll) break;
            state = game.applyActions(state, [
                roll
            ]);
            if ((state.status || '').toLowerCase() === 'finished') break;
        }
        expect(Array.isArray(state.players)).toBe(true);
    });
});
