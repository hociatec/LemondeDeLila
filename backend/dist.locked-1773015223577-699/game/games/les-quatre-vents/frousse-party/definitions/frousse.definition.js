"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FROUSSE_GAME", {
    enumerable: true,
    get: function() {
        return FROUSSE_GAME;
    }
});
const FROUSSE_GAME = {
    id: 'frousse-party',
    displayName: 'Frousse Party !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_target',
        'swap_decline',
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
