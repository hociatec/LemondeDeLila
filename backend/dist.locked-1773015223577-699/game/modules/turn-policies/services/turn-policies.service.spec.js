"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _turnpoliciesservice = require("./turn-policies.service");
describe('TurnPoliciesService non-regression', ()=>{
    let service;
    let core;
    beforeEach(()=>{
        core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...state.log ?? [],
                        {
                            message
                        }
                    ]
                }))
        };
        service = new _turnpoliciesservice.TurnPoliciesService(core);
    });
    it('resolves player names even when ids are serialized as strings', ()=>{
        const state = {
            players: [
                {
                    id: '7',
                    username: 'Olaf (zone de jeu)'
                }
            ],
            log: []
        };
        expect(service.playerName(state, 7)).toBe('Olaf');
    });
    it('appends a canonical turn announcement', ()=>{
        const state = {
            players: [
                {
                    id: 3,
                    username: 'Lila'
                }
            ],
            log: []
        };
        const out = service.appendTurnAnnouncement(state, 3);
        expect(core.appendLog).toHaveBeenCalledWith(state, "C'est au tour de Lila.");
        expect(out.log.at(-1)?.message).toBe("C'est au tour de Lila.");
    });
    it('announces pawn selection when a choose_pawn pending is active', ()=>{
        const state = {
            players: [
                {
                    id: 3,
                    username: 'Lila'
                }
            ],
            pending: {
                type: 'choose_pawn',
                playerId: 3,
                blocking: true
            },
            log: []
        };
        const out = service.appendTurnAnnouncement(state, 3);
        expect(core.appendLog).toHaveBeenCalledWith(state, "C'est à Lila de choisir un pion.");
        expect(out.log.at(-1)?.message).toBe("C'est à Lila de choisir un pion.");
    });
});
