"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BANDE_A_BANANE_GAME", {
    enumerable: true,
    get: function() {
        return BANDE_A_BANANE_GAME;
    }
});
const BANDE_A_BANANE_GAME = {
    id: 'la-bande-a-banane',
    displayName: 'La Bande à Banane !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'play_card',
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
