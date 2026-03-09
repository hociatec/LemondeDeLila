"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NAWAK_GAME", {
    enumerable: true,
    get: function() {
        return NAWAK_GAME;
    }
});
const NAWAK_GAME = {
    id: 'nawak',
    displayName: 'Nawak !',
    minPlayers: 2,
    maxPlayers: 8,
    roles: [],
    actions: [
        'choose_answer',
        'vote_answer'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
