"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LA_PARADE_SUCREE_GAME", {
    enumerable: true,
    get: function() {
        return LA_PARADE_SUCREE_GAME;
    }
});
const LA_PARADE_SUCREE_GAME = {
    id: 'la-parade-sucree',
    displayName: 'La Parade Sucrée !',
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
