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
    get ZIG_ET_ZAG_CARD_BY_ID () {
        return ZIG_ET_ZAG_CARD_BY_ID;
    },
    get ZIG_ET_ZAG_DECK () {
        return ZIG_ET_ZAG_DECK;
    },
    get ZIG_ET_ZAG_TOTAL_CARDS () {
        return ZIG_ET_ZAG_TOTAL_CARDS;
    }
});
const FAMILY_DEFINITIONS = {
    banane: {
        label: 'Banane',
        color: 'vert-sauge'
    },
    dentifrice: {
        label: 'Dentifrice',
        color: 'vert-sauge'
    },
    pantoufle: {
        label: 'Pantoufle',
        color: 'bleu-ardoise'
    },
    bougie: {
        label: 'Bougie',
        color: 'bleu-ardoise'
    }
};
const SIMPLE_CARDS = [
    {
        suffix: 'libellule',
        name: 'Libellule',
        value: 2
    },
    {
        suffix: 'souris',
        name: 'Souris',
        value: 3
    },
    {
        suffix: 'poisson',
        name: 'Poisson',
        value: 4
    },
    {
        suffix: 'poule',
        name: 'Poule',
        value: 5
    },
    {
        suffix: 'lezard',
        name: 'Lézard',
        value: 6
    },
    {
        suffix: 'chevre',
        name: 'Chèvre',
        value: 7
    },
    {
        suffix: 'chat',
        name: 'Chat',
        value: 8
    },
    {
        suffix: 'dauphin',
        name: 'Dauphin',
        value: 9
    },
    {
        suffix: 'loup',
        name: 'Loup',
        value: 10
    }
];
const FIGURE_CARDS = [
    {
        suffix: 'bergere',
        name: 'Bergère',
        value: 11
    },
    {
        suffix: 'marin',
        name: 'Marin',
        value: 12
    },
    {
        suffix: 'parachutiste',
        name: 'Parachutiste',
        value: 13
    },
    {
        suffix: 'astronaute',
        name: 'Astronaute',
        value: 14
    }
];
const deck = [];
Object.entries(FAMILY_DEFINITIONS).forEach(([family, { label, color }])=>{
    SIMPLE_CARDS.forEach((card)=>{
        deck.push({
            id: `${family}-${card.suffix}`,
            name: `${card.name} (${label})`,
            type: 'simple',
            color,
            family,
            value: card.value
        });
    });
    FIGURE_CARDS.forEach((card)=>{
        deck.push({
            id: `${family}-${card.suffix}`,
            name: `${card.name} (${label})`,
            type: 'figure',
            color,
            family,
            value: card.value
        });
    });
});
deck.push({
    id: 'joker-montgolfiere',
    name: 'Montgolfière',
    type: 'joker',
    color: 'vert-sauge',
    value: 15,
    allowedFamilies: [
        'banane',
        'dentifrice'
    ]
}, {
    id: 'joker-fusee',
    name: 'Fusée',
    type: 'joker',
    color: 'bleu-ardoise',
    value: 15,
    allowedFamilies: [
        'pantoufle',
        'bougie'
    ]
});
const ZIG_ET_ZAG_DECK = deck;
const ZIG_ET_ZAG_TOTAL_CARDS = deck.length;
const ZIG_ET_ZAG_CARD_BY_ID = Object.fromEntries(deck.map((card)=>[
        card.id,
        card
    ]));
