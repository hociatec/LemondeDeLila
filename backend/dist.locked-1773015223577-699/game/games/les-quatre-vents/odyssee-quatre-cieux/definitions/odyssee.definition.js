"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ODYSSEE_GAME", {
    enumerable: true,
    get: function() {
        return ODYSSEE_GAME;
    }
});
const ODYSSEE_GAME = {
    id: 'odyssee-quatre-cieux',
    displayName: "L'Odyssée des Quatre Cieux",
    minPlayers: 2,
    maxPlayers: 4,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'move_pawn'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
