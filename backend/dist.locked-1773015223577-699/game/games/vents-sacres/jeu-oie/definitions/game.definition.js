"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JEU_OIE_GAME", {
    enumerable: true,
    get: function() {
        return JEU_OIE_GAME;
    }
});
const JEU_OIE_GAME = {
    id: 'jeu-oie',
    displayName: "Jeu de l'oie",
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
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
