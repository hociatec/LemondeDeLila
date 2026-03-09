"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TAXI_EXPRESS_GAME", {
    enumerable: true,
    get: function() {
        return TAXI_EXPRESS_GAME;
    }
});
const TAXI_EXPRESS_GAME = {
    id: 'taxi-express',
    displayName: 'Taxi Express',
    minPlayers: 2,
    maxPlayers: 5,
    roles: [],
    actions: [
        'roll'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
