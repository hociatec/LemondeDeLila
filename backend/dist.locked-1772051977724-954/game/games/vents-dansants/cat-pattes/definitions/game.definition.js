"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CAT_PATTES_GAME", {
    enumerable: true,
    get: function() {
        return CAT_PATTES_GAME;
    }
});
const CAT_PATTES_GAME = {
    id: 'cat-pattes',
    displayName: 'Cat Pattes !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'draw',
        'play_card',
        'discard_card',
        'pass',
        'choose_pawn'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
