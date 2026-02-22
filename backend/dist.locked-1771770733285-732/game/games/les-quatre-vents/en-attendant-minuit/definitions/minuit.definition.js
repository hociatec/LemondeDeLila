"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINUIT_GAME = void 0;
exports.MINUIT_GAME = {
    id: 'en-attendant-minuit',
    displayName: 'En Attendant Minuit !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'draw',
        'choose_target',
        'answer_quiz',
        'pick_pawn',
    ],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=minuit.definition.js.map