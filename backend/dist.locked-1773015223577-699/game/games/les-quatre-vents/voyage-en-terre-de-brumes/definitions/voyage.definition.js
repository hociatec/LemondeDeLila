"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VOYAGE_GAME", {
    enumerable: true,
    get: function() {
        return VOYAGE_GAME;
    }
});
const VOYAGE_GAME = {
    id: 'voyage-en-terre-de-brumes',
    displayName: 'Voyage En Terre De Brumes !',
    minPlayers: 2,
    maxPlayers: 10,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'draw',
        'answer_quiz',
        'choose_target'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
