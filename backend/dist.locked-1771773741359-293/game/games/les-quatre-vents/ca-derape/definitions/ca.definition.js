"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CA_DERAPE_GAME = void 0;
exports.CA_DERAPE_GAME = {
    id: 'ca-derape',
    displayName: 'Ça Dérape !',
    minPlayers: 2,
    maxPlayers: 10,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_target',
        'choose_next_delta',
        'choose_next_player',
        'draw',
    ],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=ca.definition.js.map