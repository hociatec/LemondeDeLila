"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _promptpoliciesservice = require("./prompt-policies.service");
describe('PromptPoliciesService', ()=>{
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
        service = new _promptpoliciesservice.PromptPoliciesService(core);
    });
    it('appends log once and avoids duplicate consecutive entries', ()=>{
        const state = {
            log: [
                {
                    message: 'A'
                }
            ]
        };
        const same = service.appendLogOnce(state, 'A');
        expect(same).toBe(state);
        const next = service.appendLogOnce(state, 'B');
        expect(core.appendLog).toHaveBeenCalledWith(state, 'B');
        expect(next.log.at(-1)?.message).toBe('B');
    });
    it('ensures pending prompt for pending.playerId', ()=>{
        const state = {
            pending: {
                type: 'choose_pawn',
                playerId: 7
            },
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            log: []
        };
        service.ensurePendingPlayerPrompt(state, 'choose_pawn', (id)=>`P${id}`);
        expect(core.appendLog).toHaveBeenCalledWith(state, 'P7');
    });
    it('falls back to turn.currentPlayerId when pending playerId is absent', ()=>{
        const state = {
            pending: {
                type: 'draw'
            },
            turn: {
                currentPlayerId: 3,
                direction: 1
            },
            log: []
        };
        service.ensurePendingPlayerPrompt(state, 'draw', (id)=>`P${id}`);
        expect(core.appendLog).toHaveBeenCalledWith(state, 'P3');
    });
});
