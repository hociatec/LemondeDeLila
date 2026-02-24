"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOULEES_FAMILY_PACKS = exports.FOULEES_FAMILY_PENDING_LABEL = void 0;
exports.toFouleesFamilyChoice = toFouleesFamilyChoice;
exports.FOULEES_FAMILY_PENDING_LABEL = "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entree.";
exports.FOULEES_FAMILY_PACKS = [
    {
        id: 'equides',
        family: 'Equides',
        habitat: 'ecurie',
        pawns: ['Alkhal-teke', 'Andalou', 'Frison', 'Pur-sang'],
    },
    {
        id: 'primates',
        family: 'Primates',
        habitat: 'primaterie',
        pawns: ['Douc', 'Gibbon', 'Mandrill', 'Sakis'],
    },
    {
        id: 'oiseaux',
        family: 'Oiseaux',
        habitat: 'voliere',
        pawns: ['Cygne', 'Heron', 'Paon', 'Perroquet'],
    },
    {
        id: 'poissons',
        family: 'Poissons',
        habitat: 'aquarium',
        pawns: ['Anthias', 'Discus', 'Mandarin', 'Merou'],
    },
];
function toFouleesFamilyChoice(pack) {
    return {
        id: pack.id,
        label: `Famille des ${pack.family} (${pack.habitat})`,
    };
}
//# sourceMappingURL=family.definition.js.map