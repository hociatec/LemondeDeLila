"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAT_PATTES_GAME = void 0;
exports.CAT_PATTES_GAME = {
    id: 'cat-pattes',
    displayName: 'Cat Pattes !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['draw', 'play_card', 'discard_card', 'pass', 'choose_pawn'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map