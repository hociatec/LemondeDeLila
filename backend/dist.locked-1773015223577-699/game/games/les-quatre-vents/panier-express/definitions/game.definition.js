"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PANIER_EXPRESS_GAME", {
    enumerable: true,
    get: function() {
        return PANIER_EXPRESS_GAME;
    }
});
const _victorydefinition = require("./victory.definition");
const PANIER_EXPRESS_GAME = {
    id: 'panier-express',
    displayName: 'Panier Express',
    minPlayers: 2,
    maxPlayers: 10,
    roles: [],
    actions: [
        'roll',
        'ROLL_DICE',
        'roll_dice',
        'choose_pawn',
        'draw',
        'answer_quiz',
        'pick_choice',
        'exchange_choose_target',
        'exchange_choose_give',
        'exchange_accept',
        'exchange_refuse',
        'merchant_request_accept',
        'merchant_request_refuse',
        'skip_turn'
    ],
    actionsMeta: {
        exchange_choose_target: {
            blocking: true
        },
        exchange_choose_give: {
            blocking: true
        },
        exchange_accept: {
            blocking: true
        },
        exchange_refuse: {
            blocking: true
        },
        merchant_request_accept: {
            blocking: true
        },
        merchant_request_refuse: {
            blocking: true
        },
        answer_quiz: {
            blocking: true
        },
        choose_pawn: {
            blocking: true
        },
        pick_choice: {
            blocking: true
        }
    },
    phaseOrder: [
        {
            id: 'turn',
            kind: 'player-action'
        },
        {
            id: 'check_victory',
            kind: 'system'
        }
    ],
    victory: _victorydefinition.PANIER_EXPRESS_VICTORY
};
