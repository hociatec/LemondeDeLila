"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MISSION_GALAXIE_GAME", {
    enumerable: true,
    get: function() {
        return MISSION_GALAXIE_GAME;
    }
});
const MISSION_GALAXIE_GAME = {
    id: 'mission-galaxie',
    displayName: 'Mission Galaxie',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'draw',
        'choose_option',
        'choose_event_move'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
