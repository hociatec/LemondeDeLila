"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOYAGE_GAME = void 0;
exports.VOYAGE_GAME = {
    id: 'voyage-en-terre-de-brumes',
    displayName: 'Voyage En Terre De Brumes !',
    minPlayers: 2,
    maxPlayers: 10,
    roles: [],
    actions: ['roll', 'ROLL_DICE', 'draw', 'answer_quiz', 'choose_target'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=voyage.definition.js.map