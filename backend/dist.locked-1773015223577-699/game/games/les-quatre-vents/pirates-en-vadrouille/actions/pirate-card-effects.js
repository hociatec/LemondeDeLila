"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get BONUS_CARD_EFFECTS () {
        return BONUS_CARD_EFFECTS;
    },
    get OBSTACLE_CARD_EFFECTS () {
        return OBSTACLE_CARD_EFFECTS;
    },
    get describeEffect () {
        return describeEffect;
    }
});
const OBSTACLE_CARD_EFFECTS = {
    1: {
        kind: 'move',
        delta: -2
    },
    2: {
        kind: 'skip',
        turns: 1
    },
    3: {
        kind: 'skip',
        turns: 1
    },
    4: {
        kind: 'move',
        delta: -1
    },
    5: {
        kind: 'skip',
        turns: 1
    },
    6: {
        kind: 'skip',
        turns: 1
    },
    7: {
        kind: 'loseGold',
        amount: 1
    },
    8: {
        kind: 'skip',
        turns: 2
    },
    9: {
        kind: 'move',
        delta: -1
    },
    10: {
        kind: 'loseGold',
        amount: 1
    }
};
const BONUS_CARD_EFFECTS = {
    1: {
        kind: 'move',
        delta: 2
    },
    2: {
        kind: 'immunity',
        turns: 1
    },
    3: {
        kind: 'reroll'
    },
    4: {
        kind: 'move',
        delta: 2
    },
    5: {
        kind: 'immunity',
        turns: 1
    },
    6: {
        kind: 'move',
        delta: 3
    },
    7: {
        kind: 'targetMove',
        delta: -1
    },
    8: {
        kind: 'gainGold',
        amount: 1
    },
    9: {
        kind: 'stealTreasure',
        count: 1
    },
    10: {
        kind: 'immunity',
        turns: 2
    }
};
function describeEffect(effect) {
    switch(effect.kind){
        case 'move':
            return effect.delta >= 0 ? `Avance de ${effect.delta} cases.` : `Recule de ${Math.abs(effect.delta)} cases.`;
        case 'skip':
            return `Doit sauter ${effect.turns} tour(s).`;
        case 'immunity':
            return `Protégé contre ${effect.turns} obstacle(s) suivant(s).`;
        case 'gainGold':
            return `Gagne ${effect.amount} pièce(s) d'or.`;
        case 'loseGold':
            return `Perd ${effect.amount} pièce(s) d'or.`;
        case 'reroll':
            return 'Relance immédiatement le dé.';
        case 'targetMove':
            return `Ralentit un adversaire (${effect.delta}).`;
        case 'stealTreasure':
            return `Récupère ${effect.count} trésor(s) chez un adversaire.`;
        default:
            return '';
    }
}
