"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOULEES_FANTASTIQUES_GAME = void 0;
const victory_definition_1 = require("./victory.definition");
exports.FOULEES_FANTASTIQUES_GAME = {
    id: 'foulees-fantastiques',
    displayName: 'Foulées Fantastiques !',
    minPlayers: 2,
    maxPlayers: 4,
    roles: [],
    actions: ['roll', 'ROLL_DICE', 'roll_dice', 'choose_family', 'move_pawn'],
    phaseOrder: [{ id: 'turn', kind: 'player-action' }],
    victory: victory_definition_1.FOULEES_FANTASTIQUES_VICTORY,
};
//# sourceMappingURL=game.definition.js.map