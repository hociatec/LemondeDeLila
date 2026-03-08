"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GERARD_PRESIDENT_GAME", {
    enumerable: true,
    get: function() {
        return GERARD_PRESIDENT_GAME;
    }
});
const GERARD_PRESIDENT_GAME = {
    id: 'gerard-president',
    displayName: 'Gérard président !',
    minPlayers: 3,
    maxPlayers: 10,
    roles: [],
    actions: [
        'set_theme',
        'play_name',
        'play_special',
        'choose_winner',
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
