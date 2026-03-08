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
    get LES_MAINS_CARD_BY_ID () {
        return LES_MAINS_CARD_BY_ID;
    },
    get LES_MAINS_DECK () {
        return LES_MAINS_DECK;
    },
    get LES_MAINS_FAMILIES () {
        return LES_MAINS_FAMILIES;
    },
    get LES_MAINS_FAMILY_SIZE () {
        return LES_MAINS_FAMILY_SIZE;
    },
    get LES_MAINS_METIER_CARDS () {
        return LES_MAINS_METIER_CARDS;
    },
    get LES_MAINS_SPECIAL_CARDS () {
        return LES_MAINS_SPECIAL_CARDS;
    },
    get LES_MAINS_SPECIAL_CARD_IDS () {
        return LES_MAINS_SPECIAL_CARD_IDS;
    },
    get isLesMainsSpecialCard () {
        return isLesMainsSpecialCard;
    }
});
const familyCards = {
    tradition: [
        'isserande-berbere',
        'forgeron-dogon',
        'potier-zapoteque',
        'tanneur-de-fez',
        'charpentier-japonais',
        'sculptrice-de-calebasses'
    ],
    nature: [
        'cueilleur-de-the',
        'berger-nomade',
        'apiculteur-traditionnel',
        'cueilleur-de-champignons',
        'chasseur-cueilleur-pygmee',
        'eleveuse-de-yaks'
    ],
    mer: [
        'pecheur-sur-echasses',
        'plongeuse-de-perles',
        'chasseur-inuit',
        'constructeur-de-pirogues',
        'ramasseur-dalgues',
        'capitaine-de-boutre'
    ],
    art: [
        'calligraphe-chinois',
        'sculpteur-inuit',
        'masqueur-balinais',
        'peintre-dicones',
        'fabricante-de-poupees-kokeshi',
        'brodeur-touareg'
    ],
    insolites: [
        'fauconnier-kazakh',
        'gardien-de-temple',
        'dompteur-de-serpents',
        'maitre-de-the',
        'marionnettiste-wayang',
        'ramasseur-de-truffes'
    ],
    innovation: [
        'developpeur-de-jeux-video',
        'specialiste-en-drones',
        'concepteur-denergies-renouvelables',
        'bio-architecte',
        'imprimeuse-3d-medicale',
        'concepteur-de-textiles-ecologiques'
    ],
    sante: [
        'medecin-ayurvedique',
        'guerisseur-traditionnel',
        'rebouteux-andin',
        'chaman-siberien',
        'accoucheuse-bedouine',
        'herboriste-coreenne'
    ]
};
const mainCards = Object.entries(familyCards).flatMap(([family, identifiers])=>identifiers.map((id)=>({
            id: `metier-${id}`,
            name: id.replace(/-/g, ' '),
            type: 'metier',
            family: family
        })));
const specialCards = [
    {
        id: 'special-voyage-autour-du-monde',
        name: 'Voyage autour du monde',
        type: 'special'
    },
    {
        id: 'special-metier-disparu',
        name: 'Métier disparu',
        type: 'special'
    },
    {
        id: 'special-formation-express',
        name: 'Formation express',
        type: 'special'
    },
    {
        id: 'special-greve-mondiale',
        name: 'Grève mondiale',
        type: 'special'
    },
    {
        id: 'special-boussole-perdue',
        name: 'Boussole perdue',
        type: 'special'
    },
    {
        id: 'special-passation-de-savoir',
        name: 'Passation de savoir',
        type: 'special'
    },
    {
        id: 'special-fete-du-metier',
        name: 'Fête du métier',
        type: 'special'
    }
];
const LES_MAINS_METIER_CARDS = mainCards;
const LES_MAINS_SPECIAL_CARDS = specialCards;
const LES_MAINS_DECK = [
    ...mainCards,
    ...specialCards
];
const LES_MAINS_CARD_BY_ID = Object.fromEntries(LES_MAINS_DECK.map((card)=>[
        card.id,
        card
    ]));
const LES_MAINS_FAMILY_SIZE = 6;
const LES_MAINS_FAMILIES = [
    'tradition',
    'nature',
    'mer',
    'art',
    'insolites',
    'innovation',
    'sante'
];
const LES_MAINS_SPECIAL_CARD_IDS = new Set(specialCards.map((card)=>card.id));
const isLesMainsSpecialCard = (cardId)=>LES_MAINS_SPECIAL_CARD_IDS.has(cardId);
