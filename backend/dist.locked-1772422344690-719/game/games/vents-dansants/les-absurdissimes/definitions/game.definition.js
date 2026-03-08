"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ABSURDISSIMES_GAME", {
    enumerable: true,
    get: function() {
        return ABSURDISSIMES_GAME;
    }
});
const ABSURDISSIMES_GAME = {
    id: 'les-absurdissimes',
    displayName: 'Les Absurdissimes !',
    minPlayers: 3,
    maxPlayers: 8,
    roles: [],
    actions: [
        'play_card',
        'judge_pick'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
