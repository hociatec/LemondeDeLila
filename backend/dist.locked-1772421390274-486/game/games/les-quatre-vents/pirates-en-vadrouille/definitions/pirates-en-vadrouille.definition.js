"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PIRATES_GAME", {
    enumerable: true,
    get: function() {
        return PIRATES_GAME;
    }
});
const PIRATES_GAME = {
    id: 'pirates-en-vadrouille',
    displayName: 'Pirates en vadrouille !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_target'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
