"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "A_FOND_LES_BALLONS_GAME", {
    enumerable: true,
    get: function() {
        return A_FOND_LES_BALLONS_GAME;
    }
});
const A_FOND_LES_BALLONS_GAME = {
    id: 'a-fond-les-ballons',
    displayName: 'A fond les ballons !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'choose_pawn',
        'roll',
        'ROLL_DICE',
        'swap_choose_target',
        'draw'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
