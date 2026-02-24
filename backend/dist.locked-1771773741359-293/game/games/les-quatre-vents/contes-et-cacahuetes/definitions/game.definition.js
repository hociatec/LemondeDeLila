"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTES_CACAHUETES_GAME = void 0;
exports.CONTES_CACAHUETES_GAME = {
    id: 'contes-et-cacahuetes',
    displayName: 'Contes et cacahuètes !',
    minPlayers: 2,
    maxPlayers: 6,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'choose_pawn',
        'reroll_yes',
        'reroll_no',
        'choose_target',
        'choose_number',
        'choose_option',
        'choose_card',
        'draw',
    ],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: null,
};
//# sourceMappingURL=game.definition.js.map