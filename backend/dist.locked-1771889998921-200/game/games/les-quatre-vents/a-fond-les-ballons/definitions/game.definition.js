"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.A_FOND_LES_BALLONS_GAME = void 0;
exports.A_FOND_LES_BALLONS_GAME = {
    id: 'a-fond-les-ballons',
    displayName: 'A fond les ballons !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['choose_pawn', 'roll', 'ROLL_DICE', 'swap_choose_target', 'draw'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map