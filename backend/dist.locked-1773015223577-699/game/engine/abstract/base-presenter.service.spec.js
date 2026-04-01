"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _basepresenterservice = require("./base-presenter.service");
let TestPresenter = class TestPresenter extends _basepresenterservice.BasePresenterService {
    buildCatalog() {
        return {
            phases: [
                'play'
            ],
            victory: null
        };
    }
    getAvailableActionsForUser(state, userId) {
        return state.turn?.currentPlayerId === userId ? [] : [];
    }
    buildPendingState(state, _metadata, _currentPlayerId) {
        void _metadata;
        void _currentPlayerId;
        return state.pending ?? null;
    }
    buildExtras(_state, _metadata, _currentPlayerId) {
        void _state;
        void _metadata;
        void _currentPlayerId;
        return {};
    }
    exposeForUser(state, userId) {
        return this.buildExposedStateForUser(state, userId);
    }
};
describe('BasePresenterService', ()=>{
    const makeState = (pending)=>({
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
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
            metadata: {},
            pending,
            log: [],
            lastRoll: null
        });
    it('hides targeted pending for other users by default', ()=>{
        const presenter = new TestPresenter();
        const state = makeState({
            type: 'choose_pawn',
            playerId: 1,
            blocking: true,
            label: 'Choisir un pion'
        });
        const forOwner = presenter.exposeForUser(state, 1);
        const forOther = presenter.exposeForUser(state, 2);
        expect(forOwner.pending).not.toBeNull();
        expect(forOther.pending).toBeNull();
    });
    it('keeps non-targeted pending visible for all users', ()=>{
        const presenter = new TestPresenter();
        const state = makeState({
            type: 'info',
            blocking: false,
            label: 'Information'
        });
        const forUser1 = presenter.exposeForUser(state, 1);
        const forUser2 = presenter.exposeForUser(state, 2);
        expect(forUser1.pending).not.toBeNull();
        expect(forUser2.pending).not.toBeNull();
    });
});
