"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TOUT_PRES_DE_MAMAN_GAME", {
    enumerable: true,
    get: function() {
        return TOUT_PRES_DE_MAMAN_GAME;
    }
});
const TOUT_PRES_DE_MAMAN_GAME = {
    id: 'tout-pres-de-maman',
    displayName: 'Tout près de Maman !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
