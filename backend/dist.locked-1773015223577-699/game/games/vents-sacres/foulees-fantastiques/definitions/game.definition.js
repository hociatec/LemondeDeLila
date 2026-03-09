"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FOULEES_FANTASTIQUES_GAME", {
    enumerable: true,
    get: function() {
        return FOULEES_FANTASTIQUES_GAME;
    }
});
const _victorydefinition = require("./victory.definition");
const FOULEES_FANTASTIQUES_GAME = {
    id: 'foulees-fantastiques',
    displayName: 'Foulées Fantastiques !',
    minPlayers: 2,
    maxPlayers: 4,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'roll_dice',
        'choose_family',
        'move_pawn'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: _victorydefinition.FOULEES_FANTASTIQUES_VICTORY
};
