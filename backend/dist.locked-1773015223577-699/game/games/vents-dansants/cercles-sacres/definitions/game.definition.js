"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CERCLES_SACRES_GAME", {
    enumerable: true,
    get: function() {
        return CERCLES_SACRES_GAME;
    }
});
const CERCLES_SACRES_GAME = {
    id: 'cercles-sacres',
    displayName: 'Cercles Sacrés',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'form_circle',
        'discard_card',
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
