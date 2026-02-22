"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAWAK_GAME = void 0;
exports.NAWAK_GAME = {
    id: 'nawak',
    displayName: 'Nawak !',
    minPlayers: 2,
    maxPlayers: 8,
    roles: [],
    actions: ['choose_answer', 'vote_answer'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map