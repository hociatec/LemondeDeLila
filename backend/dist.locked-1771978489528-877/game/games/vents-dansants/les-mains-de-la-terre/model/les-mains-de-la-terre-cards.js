"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLesMainsSpecialCard = exports.LES_MAINS_SPECIAL_CARD_IDS = exports.LES_MAINS_FAMILIES = exports.LES_MAINS_FAMILY_SIZE = exports.LES_MAINS_CARD_BY_ID = exports.LES_MAINS_DECK = exports.LES_MAINS_SPECIAL_CARDS = exports.LES_MAINS_METIER_CARDS = void 0;
const familyCards = {
    tradition: [
        'isserande-berbere',
        'forgeron-dogon',
        'potier-zapoteque',
        'tanneur-de-fez',
        'charpentier-japonais',
        'sculptrice-de-calebasses',
    ],
    nature: [
        'cueilleur-de-the',
        'berger-nomade',
        'apiculteur-traditionnel',
        'cueilleur-de-champignons',
        'chasseur-cueilleur-pygmee',
        'eleveuse-de-yaks',
    ],
    mer: [
        'pecheur-sur-echasses',
        'plongeuse-de-perles',
        'chasseur-inuit',
        'constructeur-de-pirogues',
        'ramasseur-dalgues',
        'capitaine-de-boutre',
    ],
    art: [
        'calligraphe-chinois',
        'sculpteur-inuit',
        'masqueur-balinais',
        'peintre-dicones',
        'fabricante-de-poupees-kokeshi',
        'brodeur-touareg',
    ],
    insolites: [
        'fauconnier-kazakh',
        'gardien-de-temple',
        'dompteur-de-serpents',
        'maitre-de-the',
        'marionnettiste-wayang',
        'ramasseur-de-truffes',
    ],
    innovation: [
        'developpeur-de-jeux-video',
        'specialiste-en-drones',
        'concepteur-denergies-renouvelables',
        'bio-architecte',
        'imprimeuse-3d-medicale',
        'concepteur-de-textiles-ecologiques',
    ],
    sante: [
        'medecin-ayurvedique',
        'guerisseur-traditionnel',
        'rebouteux-andin',
        'chaman-siberien',
        'accoucheuse-bedouine',
        'herboriste-coreenne',
    ],
};
const mainCards = Object.entries(familyCards).flatMap(([family, identifiers]) => identifiers.map((id) => ({
    id: `metier-${id}`,
    name: id.replace(/-/g, ' '),
    type: 'metier',
    family: family,
})));
const specialCards = [
    {
        id: 'special-voyage-autour-du-monde',
        name: 'Voyage autour du monde',
        type: 'special',
    },
    { id: 'special-metier-disparu', name: 'Métier disparu', type: 'special' },
    {
        id: 'special-formation-express',
        name: 'Formation express',
        type: 'special',
    },
    { id: 'special-greve-mondiale', name: 'Grève mondiale', type: 'special' },
    { id: 'special-boussole-perdue', name: 'Boussole perdue', type: 'special' },
    {
        id: 'special-passation-de-savoir',
        name: 'Passation de savoir',
        type: 'special',
    },
    { id: 'special-fete-du-metier', name: 'Fête du métier', type: 'special' },
];
exports.LES_MAINS_METIER_CARDS = mainCards;
exports.LES_MAINS_SPECIAL_CARDS = specialCards;
exports.LES_MAINS_DECK = [...mainCards, ...specialCards];
exports.LES_MAINS_CARD_BY_ID = Object.fromEntries(exports.LES_MAINS_DECK.map((card) => [card.id, card]));
exports.LES_MAINS_FAMILY_SIZE = 6;
exports.LES_MAINS_FAMILIES = [
    'tradition',
    'nature',
    'mer',
    'art',
    'insolites',
    'innovation',
    'sante',
];
exports.LES_MAINS_SPECIAL_CARD_IDS = new Set(specialCards.map((card) => card.id));
const isLesMainsSpecialCard = (cardId) => exports.LES_MAINS_SPECIAL_CARD_IDS.has(cardId);
exports.isLesMainsSpecialCard = isLesMainsSpecialCard;
//# sourceMappingURL=les-mains-de-la-terre-cards.js.map