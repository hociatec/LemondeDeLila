"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnselection = require("../pawn-selection");
function makeMeta(pawns) {
    return {
        tiles: [],
        positions: {},
        statuses: {
            skipTurn: {},
            ignoreNextTrap: {},
            ignoreTrapUntilNextDraw: {},
            ignoreNextPrank: {},
            ignoreNextGhost: {},
            nextMoveCap: {},
            nextRollMalus: {},
            nextRollKeepLowest: {},
            nextRollDouble: {},
            nextRollIfThreeBackTwo: {},
            blocked: {}
        },
        decks: {
            cards: [],
            discard: []
        },
        pawns
    };
}
describe('buildPawnSelectionPending', ()=>{
    it('returns null when no valid players are provided', ()=>{
        const pending = (0, _pawnselection.buildPawnSelectionPending)([
            null,
            undefined,
            {
                id: '1'
            },
            {}
        ], makeMeta([
            {
                id: 'wolf',
                name: 'Loup'
            }
        ]));
        expect(pending).toBeNull();
    });
    it('returns null when no pawn candidate is available', ()=>{
        const pending = (0, _pawnselection.buildPawnSelectionPending)([
            {
                id: 1,
                pawn: 'wolf'
            },
            {
                id: 2,
                pawn: 'fox'
            }
        ], makeMeta([
            {
                id: 'wolf',
                name: 'Loup'
            },
            {
                id: 'fox',
                name: 'Renard'
            }
        ]));
        expect(pending).toBeNull();
    });
    it('returns null when all players already have a pawn', ()=>{
        const pending = (0, _pawnselection.buildPawnSelectionPending)([
            {
                id: 1,
                pawn: 'wolf'
            },
            {
                id: 2,
                pawn: 'fox'
            }
        ], makeMeta([
            {
                id: 'wolf',
                name: 'Loup'
            },
            {
                id: 'fox',
                name: 'Renard'
            },
            {
                id: 'owl',
                name: 'Hibou'
            }
        ]));
        expect(pending).toBeNull();
    });
    it('builds choose_pawn pending for first unassigned player', ()=>{
        const pending = (0, _pawnselection.buildPawnSelectionPending)([
            {
                id: 1,
                pawn: 'wolf'
            },
            {
                id: 2
            },
            {
                id: 3,
                pawn: null
            },
            {
                id: 4,
                pawn: 'fox'
            }
        ], makeMeta([
            {
                id: 'wolf',
                name: 'Loup',
                description: 'Rapide'
            },
            {
                id: 'fox',
                name: 'Renard'
            },
            {
                id: 'bear',
                name: '',
                description: 'Très fort'
            },
            {
                id: 'owl',
                name: 'Hibou',
                description: 'Silencieux'
            }
        ]));
        expect(pending).toEqual({
            type: 'choose_pawn',
            playerId: 2,
            blocking: true,
            choices: [
                'Très fort',
                'Hibou: Silencieux'
            ],
            data: {
                kind: 'choose_pawn',
                pawns: [
                    {
                        id: 'bear',
                        name: '',
                        description: 'Très fort'
                    },
                    {
                        id: 'owl',
                        name: 'Hibou',
                        description: 'Silencieux'
                    }
                ]
            }
        });
    });
});
