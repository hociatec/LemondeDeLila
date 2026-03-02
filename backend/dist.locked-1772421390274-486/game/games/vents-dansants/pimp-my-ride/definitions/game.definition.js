"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PIMP_MY_RIDE_GAME", {
    enumerable: true,
    get: function() {
        return PIMP_MY_RIDE_GAME;
    }
});
const PIMP_MY_RIDE_GAME = {
    id: 'pimp-my-ride',
    displayName: 'Pimp My Ride',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'play_card',
        'discard_card',
        'pass'
    ],
    phaseOrder: [
        {
            id: 'round',
            kind: 'player-action'
        }
    ],
    victory: null
};
