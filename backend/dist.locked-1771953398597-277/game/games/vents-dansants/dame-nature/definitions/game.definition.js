"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAME_NATURE_GAME = void 0;
exports.DAME_NATURE_GAME = {
    id: 'dame-nature',
    displayName: 'Dame Nature',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['ask_card', 'pass'],
    phaseOrder: [{ id: 'round', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map