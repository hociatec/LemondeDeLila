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
    get ENTRE_RITES_CARD_BY_ID () {
        return ENTRE_RITES_CARD_BY_ID;
    },
    get ENTRE_RITES_CUSTOM_FAMILY_SIZE () {
        return ENTRE_RITES_CUSTOM_FAMILY_SIZE;
    },
    get ENTRE_RITES_DECK () {
        return ENTRE_RITES_DECK;
    },
    get ENTRE_RITES_FAMILY_CARDS () {
        return ENTRE_RITES_FAMILY_CARDS;
    },
    get ENTRE_RITES_SPECIAL_CARDS () {
        return ENTRE_RITES_SPECIAL_CARDS;
    }
});
const FAMILY_DEFINITIONS = [
    {
        id: 'symboles-sacres',
        name: 'Symboles Sacrés',
        members: [
            'La Croix',
            'Le mouton',
            'La Cloche',
            'Le Pain Azyme',
            'La Lumière',
            'L’Eau Bénite',
            'Le Tombeau Vide'
        ]
    },
    {
        id: 'creatures-de-paques',
        name: 'Créatures de Pâques',
        members: [
            'Le Lapin',
            'La Poule',
            'L’Agneau',
            'Le Papillon',
            'L’Hirondelle',
            'L’Abeille',
            'Le Lièvre Blanc'
        ]
    },
    {
        id: 'traditions-et-fetes',
        name: 'Traditions & Fêtes',
        members: [
            'Ostara',
            'Pessa’h',
            'La Messe de Pâques',
            'La Chasse aux œufs',
            'Le Lundi de Pâques',
            'Le Festin de famille',
            'La Veillée Pascale'
        ]
    },
    {
        id: 'gourmandises-objets',
        name: 'Gourmandises & Objets',
        members: [
            'Œuf en chocolat',
            'Panier de Pâques',
            'Brioche tressée',
            'Cloche en sucre',
            'Gâteau en forme d’agneau',
            'Nid de printemps',
            'Dragées multicolores'
        ]
    },
    {
        id: 'nature-saisons',
        name: 'Nature & Saisons',
        members: [
            'Le Printemps',
            'Arbre en fleurs',
            'Rayon de soleil',
            'Éclosion',
            'Arc-en-ciel',
            'Douce pluie',
            'Champ fleuri'
        ]
    }
];
const SPECIALS = [
    {
        id: 'lapin-d-or',
        type: 'special',
        name: 'Le Lapin d’Or',
        description: 'Piochez deux cartes. Choisissez-en une pour votre main et ajoutez-la immédiatement ; l’autre va dans la défausse.',
        effect: 'draw_two_choose_one'
    },
    {
        id: 'oeuf-surprise',
        type: 'special',
        name: 'L’Œuf Surprise',
        description: 'Piochez une carte supplémentaire et appliquez immédiatement son effet caché.',
        effect: 'draw_and_trigger'
    },
    {
        id: 'benediction',
        type: 'special',
        name: 'La Bénédiction',
        description: 'Tous les autres joueurs vous offrent une carte de leur choix.',
        effect: 'collect_from_others'
    },
    {
        id: 'resurrection',
        type: 'special',
        name: 'La Résurrection',
        description: 'Reprenez une carte depuis la défausse et ajoutez-la dans votre main pour rejouer.',
        effect: 'take_from_discard'
    },
    {
        id: 'silence-sacre',
        type: 'special',
        name: 'Le Silence Sacré',
        description: 'Les effets spéciaux sont annulés jusqu’à votre prochain tour (aucun effet automatisé ne peut être déclenché).',
        effect: 'mute_specials'
    },
    {
        id: 'envol-mystique',
        type: 'special',
        name: 'L’Envol Mystique',
        description: 'Échangez toutes vos cartes avec celles d’un autre joueur.',
        effect: 'swap_hands'
    },
    {
        id: 'cle-jardin',
        type: 'special',
        name: 'La Clé du Jardin Caché',
        description: 'Posez trois cartes issues de familles différentes comme si elles formaient une famille complète.',
        effect: 'free_family'
    },
    {
        id: 'aube-nouvelle',
        type: 'special',
        name: 'L’Aube Nouvelle',
        description: 'Chaque joueur défausse une carte puis pioche deux cartes.',
        effect: 'reshuffle_cycle'
    },
    {
        id: 'etoile-orient',
        type: 'special',
        name: 'L’Étoile de l’Orient',
        description: 'Personne ne peut demander de cartes ni jouer de pouvoirs pendant deux tours.',
        effect: 'peace_turns'
    },
    {
        id: 'chant-coq',
        type: 'special',
        name: 'Le Chant du Coq',
        description: 'Chaque joueur révèle sa main et vous pouvez choisir une carte révélée.',
        effect: 'reveal_and_steal'
    }
];
const createFamilyCards = ()=>{
    const cards = [];
    for (const family of FAMILY_DEFINITIONS){
        family.members.forEach((member, index)=>{
            cards.push({
                id: `${family.id}-${index + 1}`,
                type: 'family',
                name: member,
                familyId: family.id,
                familyName: family.name
            });
        });
    }
    return cards;
};
const ENTRE_RITES_FAMILY_CARDS = createFamilyCards();
const ENTRE_RITES_SPECIAL_CARDS = SPECIALS;
const ENTRE_RITES_DECK = [
    ...ENTRE_RITES_FAMILY_CARDS,
    ...ENTRE_RITES_SPECIAL_CARDS
];
const ENTRE_RITES_CUSTOM_FAMILY_SIZE = Object.fromEntries(FAMILY_DEFINITIONS.map((family)=>[
        family.id,
        family.members.length
    ]));
const ENTRE_RITES_CARD_BY_ID = Object.fromEntries(ENTRE_RITES_DECK.map((card)=>[
        card.id,
        card
    ]));
