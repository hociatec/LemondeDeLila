"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CERCLES_SACRES_GAME = void 0;
exports.CERCLES_SACRES_GAME = {
    id: 'cercles-sacres',
    displayName: 'Cercles Sacrés',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: ['form_circle', 'discard_card', 'pass'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map