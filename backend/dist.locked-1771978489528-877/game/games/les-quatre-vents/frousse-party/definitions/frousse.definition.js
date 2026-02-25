"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FROUSSE_GAME = void 0;
exports.FROUSSE_GAME = {
    id: 'frousse-party',
    displayName: 'Frousse Party !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['roll', 'ROLL_DICE', 'choose_target', 'draw', 'choose_pawn'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=frousse.definition.js.map