"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GERARD_PRESIDENT_GAME = void 0;
exports.GERARD_PRESIDENT_GAME = {
    id: 'gerard-president',
    displayName: 'Gérard président !',
    minPlayers: 3,
    maxPlayers: 10,
    roles: [],
    actions: ['set_theme', 'play_name', 'play_special', 'choose_winner', 'pass'],
    phaseOrder: [{ id: 'round', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map