"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_CANDIES = exports.CANDY_VALUES = exports.LA_PARADE_SPECIAL_REWARDS = exports.LA_PARADE_CARD_BY_ID = exports.LA_PARADE_CARD_DECK = exports.LA_PARADE_SEQUENCE = void 0;
exports.LA_PARADE_SEQUENCE = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'V',
    'D',
    'R',
    'A',
];
exports.LA_PARADE_CARD_DECK = [
    {
        id: 'parade-2',
        name: 'Jacques – Le Tambourinaire',
        value: '2',
        special: false,
    },
    { id: 'parade-3', name: 'Rémi – Le Jongleur', value: '3', special: false },
    {
        id: 'parade-4',
        name: 'Tina – La Danseuse Colorée',
        value: '4',
        special: false,
    },
    {
        id: 'parade-5',
        name: 'Mélissa – La Lanceuse de Bonbons',
        value: '5',
        special: false,
    },
    { id: 'parade-6', name: 'Nico – L’Acrobate', value: '6', special: false },
    { id: 'parade-7', name: 'Farou – Le Farceur', value: '7', special: true },
    {
        id: 'parade-8',
        name: 'Laura – Le Masque Mystérieux',
        value: '8',
        special: false,
    },
    { id: 'parade-9', name: 'Francis – Le Pêcheur', value: '9', special: false },
    {
        id: 'parade-10',
        name: 'Roland – Le Roi du Carnaval',
        value: '10',
        special: true,
    },
    { id: 'parade-v', name: 'Dimitri – Le Bouffon', value: 'V', special: true },
    {
        id: 'parade-d',
        name: 'Daniella – La Reine du Bal',
        value: 'D',
        special: true,
    },
    {
        id: 'parade-r',
        name: 'Fabien – Le Capitaine de la Parade',
        value: 'R',
        special: true,
    },
    {
        id: 'parade-a',
        name: 'Régis – Le Trompettiste',
        value: 'A',
        special: false,
    },
];
exports.LA_PARADE_CARD_BY_ID = Object.fromEntries(exports.LA_PARADE_CARD_DECK.map((card) => [card.id, card]));
exports.LA_PARADE_SPECIAL_REWARDS = {
    '7': { Chocobon: 1 },
    '10': { Chamallow: 1 },
    V: { Chamallow: 2 },
    D: { Chamallow: 3 },
    R: { Chamallow: 4 },
};
exports.CANDY_VALUES = {
    Chamallow: 1,
    Chocobon: 5,
    Balisto: 10,
};
exports.INITIAL_CANDIES = {
    Chamallow: 1,
    Chocobon: 1,
    Balisto: 1,
};
//# sourceMappingURL=la-parade-sucree-cards.js.map