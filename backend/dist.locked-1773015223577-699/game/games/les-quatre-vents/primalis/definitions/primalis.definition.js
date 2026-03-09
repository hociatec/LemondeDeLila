"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PRIMALIS_GAME", {
    enumerable: true,
    get: function() {
        return PRIMALIS_GAME;
    }
});
const PRIMALIS_GAME = {
    id: 'primalis',
    displayName: 'Primalis',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
