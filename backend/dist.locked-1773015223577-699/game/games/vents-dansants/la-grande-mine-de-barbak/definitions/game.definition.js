"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LA_GRANDE_MINE_GAME", {
    enumerable: true,
    get: function() {
        return LA_GRANDE_MINE_GAME;
    }
});
const LA_GRANDE_MINE_GAME = {
    id: 'la-grande-mine-de-barbak',
    displayName: 'La Grande Mine de Barbak !',
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
