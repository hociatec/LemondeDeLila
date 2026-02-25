"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OLYMPIA_GAME", {
    enumerable: true,
    get: function() {
        return OLYMPIA_GAME;
    }
});
const OLYMPIA_GAME = {
    id: 'olympia',
    displayName: 'Olympia',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'draw_card',
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
