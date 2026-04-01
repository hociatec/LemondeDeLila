"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DAME_NATURE_GAME", {
    enumerable: true,
    get: function() {
        return DAME_NATURE_GAME;
    }
});
const DAME_NATURE_GAME = {
    id: 'dame-nature',
    displayName: 'Dame Nature',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'ask_card',
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
