"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MON_VILLAGE_GAME", {
    enumerable: true,
    get: function() {
        return MON_VILLAGE_GAME;
    }
});
const MON_VILLAGE_GAME = {
    id: 'mon-village-mon-histoire',
    displayName: 'Mon Village, Mon Histoire',
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
