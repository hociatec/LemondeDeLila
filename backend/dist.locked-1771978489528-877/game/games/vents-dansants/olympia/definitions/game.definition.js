"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OLYMPIA_GAME = void 0;
exports.OLYMPIA_GAME = {
    id: 'olympia',
    displayName: 'Olympia',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['draw_card', 'play_card', 'pass'],
    phaseOrder: [{ id: 'round', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map