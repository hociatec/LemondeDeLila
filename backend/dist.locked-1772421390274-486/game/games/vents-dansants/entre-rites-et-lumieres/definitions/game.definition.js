"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ENTRE_RITES_GAME", {
    enumerable: true,
    get: function() {
        return ENTRE_RITES_GAME;
    }
});
const ENTRE_RITES_GAME = {
    id: 'entre-rites-et-lumieres',
    displayName: 'Entre Rites & Lumières !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'ask_card',
        'pass'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
