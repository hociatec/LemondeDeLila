"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SAC_A_MALICES_GAME", {
    enumerable: true,
    get: function() {
        return SAC_A_MALICES_GAME;
    }
});
const SAC_A_MALICES_GAME = {
    id: 'sac-a-malices',
    displayName: 'Sac à Malices!',
    minPlayers: 2,
    maxPlayers: 8,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'buy',
        'skip_buy',
        'build',
        'sell_building',
        'mortgage',
        'unmortgage',
        'choose_property',
        'pay_fine',
        'use_jail_card',
        'sac_set_variant'
    ],
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        }
    ],
    victory: null
};
