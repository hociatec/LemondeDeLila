"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GALOPONS_GAME", {
    enumerable: true,
    get: function() {
        return GALOPONS_GAME;
    }
});
const GALOPONS_GAME = {
    id: 'galopons-ensemble',
    displayName: 'Galopons ensemble !',
    minPlayers: 2,
    maxPlayers: 4,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_target',
        'draw',
        'choose_pawn'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
