"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CA_DERAPE_GAME", {
    enumerable: true,
    get: function() {
        return CA_DERAPE_GAME;
    }
});
const CA_DERAPE_GAME = {
    id: 'ca-derape',
    displayName: 'Ça Dérape !',
    minPlayers: 2,
    maxPlayers: 10,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_target',
        'choose_next_delta',
        'choose_next_player',
        'draw'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
