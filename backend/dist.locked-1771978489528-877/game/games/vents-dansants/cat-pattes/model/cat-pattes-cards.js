"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAT_PATTES_PAWNS = exports.CAT_PATTES_CARD_BY_ID = exports.CAT_PATTES_DECK = void 0;
const createCopies = (prefix, count, value) => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    ...value,
}));
const deck = [
    ...createCopies('pattes-20', 10, {
        type: 'pattes',
        name: 'Petite foulée',
        value: 20,
    }),
    ...createCopies('pattes-50', 10, {
        type: 'pattes',
        name: 'Sprint du matin',
        value: 50,
    }),
    ...createCopies('pattes-80', 10, {
        type: 'pattes',
        name: 'Course-poursuite',
        value: 80,
    }),
    ...createCopies('pattes-130', 12, {
        type: 'pattes',
        name: 'Chasse à la souris',
        value: 130,
    }),
    ...createCopies('pattes-150', 4, {
        type: 'pattes',
        name: 'Turbochat',
        value: 150,
    }),
    ...createCopies('obstacle-gamelle', 3, {
        type: 'obstacle',
        name: 'Gamelle vide',
        obstacle: 'gamelle',
    }),
    ...createCopies('obstacle-pluie', 5, {
        type: 'obstacle',
        name: 'Pluie torrentielle',
        obstacle: 'pluie',
    }),
    ...createCopies('obstacle-chien', 3, {
        type: 'obstacle',
        name: 'Chien enragé',
        obstacle: 'chien',
    }),
    ...createCopies('obstacle-coussin', 3, {
        type: 'obstacle',
        name: 'Coussin piégé',
        obstacle: 'coussin',
    }),
    ...createCopies('obstacle-sol', 4, {
        type: 'obstacle',
        name: 'Sol ciré',
        obstacle: 'sol',
    }),
    ...createCopies('parade-croquettes', 6, {
        type: 'parade',
        name: 'Croquettes',
        parade: 'croquettes',
    }),
    ...createCopies('parade-rayon', 14, {
        type: 'parade',
        name: 'Rayon de soleil',
        parade: 'rayon',
    }),
    ...createCopies('parade-dodo', 6, {
        type: 'parade',
        name: 'Dodo réparateur',
        parade: 'dodo',
    }),
    ...createCopies('parade-coussin', 6, {
        type: 'parade',
        name: 'Nouveau coussin',
        parade: 'coussin',
    }),
    ...createCopies('parade-saut', 6, {
        type: 'parade',
        name: 'Saut agile',
        parade: 'saut',
    }),
    {
        id: 'bot-reserve',
        type: 'bot',
        name: 'Réserve secrète',
        bot: 'reserve',
    },
    {
        id: 'bot-chat-ninja',
        type: 'bot',
        name: 'Chat Ninja',
        bot: 'chat-ninja',
    },
    {
        id: 'bot-patte-blindee',
        type: 'bot',
        name: 'Patte blindée',
        bot: 'patte-blindee',
    },
    {
        id: 'bot-passage-star',
        type: 'bot',
        name: 'Passage de star',
        bot: 'passage-star',
    },
];
exports.CAT_PATTES_DECK = deck;
exports.CAT_PATTES_CARD_BY_ID = Object.fromEntries(deck.map((card) => [card.id, card]));
exports.CAT_PATTES_PAWNS = [
    'Maine Coon',
    'Siamois',
    'Persan',
    'Bengal',
    'Chartreux',
    'Angora',
];
//# sourceMappingURL=cat-pattes-cards.js.map