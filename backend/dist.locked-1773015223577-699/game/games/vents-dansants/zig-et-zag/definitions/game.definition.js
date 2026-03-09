"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ZIG_ET_ZAG_GAME", {
    enumerable: true,
    get: function() {
        return ZIG_ET_ZAG_GAME;
    }
});
const ZIG_ET_ZAG_GAME = {
    id: 'zig-et-zag',
    displayName: 'Zig et Zag !',
    minPlayers: 2,
    maxPlayers: 2,
    roles: [],
    actions: [
        'draw_card',
        'select_card'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
