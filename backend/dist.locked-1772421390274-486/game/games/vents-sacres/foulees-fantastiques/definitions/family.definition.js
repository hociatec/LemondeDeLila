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
    get FOULEES_FAMILY_PACKS () {
        return FOULEES_FAMILY_PACKS;
    },
    get FOULEES_FAMILY_PENDING_LABEL () {
        return FOULEES_FAMILY_PENDING_LABEL;
    },
    get toFouleesFamilyChoice () {
        return toFouleesFamilyChoice;
    }
});
const FOULEES_FAMILY_PENDING_LABEL = "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entree.";
const FOULEES_FAMILY_PACKS = [
    {
        id: 'equides',
        family: 'Equides',
        habitat: 'ecurie',
        pawns: [
            'Alkhal-teke',
            'Andalou',
            'Frison',
            'Pur-sang'
        ]
    },
    {
        id: 'primates',
        family: 'Primates',
        habitat: 'primaterie',
        pawns: [
            'Douc',
            'Gibbon',
            'Mandrill',
            'Sakis'
        ]
    },
    {
        id: 'oiseaux',
        family: 'Oiseaux',
        habitat: 'voliere',
        pawns: [
            'Cygne',
            'Heron',
            'Paon',
            'Perroquet'
        ]
    },
    {
        id: 'poissons',
        family: 'Poissons',
        habitat: 'aquarium',
        pawns: [
            'Anthias',
            'Discus',
            'Mandarin',
            'Merou'
        ]
    }
];
function toFouleesFamilyChoice(pack) {
    return {
        id: pack.id,
        label: `Famille des ${pack.family} (${pack.habitat})`
    };
}
