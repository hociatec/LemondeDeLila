"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BANDE_A_BANANE_CARD_BY_ID = exports.BANDE_A_BANANE_DECK = void 0;
const createCopies = (prefix, count, details) => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    ...details,
}));
const deck = [
    ...createCopies('monkey-capucin', 6, {
        type: 'monkey',
        name: 'Capucin malicieux',
        species: 'capucin',
    }),
    ...createCopies('monkey-mandrill', 6, {
        type: 'monkey',
        name: 'Mandrill paradeur',
        species: 'mandrill',
    }),
    ...createCopies('monkey-gibbon', 6, {
        type: 'monkey',
        name: 'Gibbon bondissant',
        species: 'gibbon',
    }),
    ...createCopies('monkey-babouin', 6, {
        type: 'monkey',
        name: 'Babouin observateur',
        species: 'babouin',
    }),
    ...createCopies('monkey-macaque', 6, {
        type: 'monkey',
        name: 'Macaque zen',
        species: 'macaque',
    }),
    ...createCopies('action-vol-de-banane', 5, {
        type: 'action',
        name: 'Vol de banane',
        action: 'vol-de-banane',
    }),
    ...createCopies('action-cris-de-la-jungle', 5, {
        type: 'action',
        name: 'Cris de la jungle',
        action: 'cris-de-la-jungle',
    }),
    ...createCopies('action-grimpeur-fou', 5, {
        type: 'action',
        name: 'Grimpeur fou',
        action: 'grimpeur-fou',
    }),
    ...createCopies('trap-piege-a-noix-de-coco', 5, {
        type: 'trap',
        name: 'Piège à noix de coco',
        trap: 'piege-a-noix-de-coco',
    }),
    ...createCopies('trap-tigre-rodeur', 5, {
        type: 'trap',
        name: 'Tigre rôdeur',
        trap: 'tigre-rodeur',
    }),
    ...createCopies('joker-singe-deguise', 5, {
        type: 'joker',
        name: 'Singe déguisé',
    }),
];
exports.BANDE_A_BANANE_DECK = deck;
exports.BANDE_A_BANANE_CARD_BY_ID = Object.fromEntries(deck.map((card) => [card.id, card]));
//# sourceMappingURL=la-bande-a-banane-cards.js.map