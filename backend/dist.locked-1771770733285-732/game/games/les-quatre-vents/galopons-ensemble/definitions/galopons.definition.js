"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GALOPONS_GAME = void 0;
exports.GALOPONS_GAME = {
    id: 'galopons-ensemble',
    displayName: 'Galopons ensemble !',
    minPlayers: 2,
    maxPlayers: 4,
    roles: [],
    actions: ['roll', 'ROLL_DICE', 'choose_target', 'draw'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=galopons.definition.js.map