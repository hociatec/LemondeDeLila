"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _afondlesballonsactionservice = require("../actions/a-fond-les-ballons-action.service");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
describe('AFondLesBallonsActionService', ()=>{
    function createService() {
        return new _afondlesballonsactionservice.AFondLesBallonsActionService(new _gamecoreservice.GameCoreService(), {}, {}, {}, new _setupflowservice.SetupFlowService());
    }
    it('announces the next player when advancing turn with skip logs', ()=>{
        const service = createService();
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Bucky'
                }
            ],
            log: [],
            metadata: {
                statuses: {
                    skipTurn: {}
                }
            }
        };
        const next = service.advanceTurnWithSkipLogs(state);
        const messages = (next.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(next.turn?.currentPlayerId).toBe(2);
        expect(messages).toContain("C'est au tour de Bucky.");
    });
    it('announces the starter after the last pawn is chosen', ()=>{
        const service = createService();
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                }
            ],
            log: [],
            pending: {
                type: 'choose_pawn',
                playerId: 1,
                blocking: true,
                data: {
                    pawns: [
                        {
                            id: 'lutin',
                            label: 'Lutin',
                            description: 'Petit aventurier.'
                        }
                    ]
                }
            },
            metadata: {
                setupStarterId: 1,
                pawns: [
                    {
                        id: 'lutin',
                        label: 'Lutin',
                        description: 'Petit aventurier.'
                    }
                ],
                pawnByPlayerId: {},
                charactersByPlayerId: {}
            }
        };
        const next = service.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawn: 'lutin'
                }
            }
        ]);
        const messages = (next.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(next.pending).toBeNull();
        expect(next.turn?.currentPlayerId).toBe(1);
        expect(messages).toContain("C'est au tour de Lilas.");
    });
});
