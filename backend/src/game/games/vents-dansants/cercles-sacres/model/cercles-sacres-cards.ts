export type CerclesSacresTheme =
  | 'totem'
  | 'nature'
  | 'plante'
  | 'esprit'
  | 'parole'
  | 'nation';

export interface CerclesSacresCardDefinition {
  id: string;
  name: string;
  theme: CerclesSacresTheme;
}

const TOTEM_NAMES = [
  'Lâ€™Aigle visionnaire',
  'Le Loup protecteur',
  'Lâ€™Ours guérisseur',
  'Le Bison sacré',
  'Le Colibri messager',
  'Le Renard rusé',
  'Le Cerf élégant',
  'Le Castor bâtisseur',
  'Le Puma silencieux',
  'Le Serpent de transformation',
  'La Tortue éternelle',
  'La Grenouille chanteuse',
  'Le Corbeau du mystère',
  'Le Coyote farceur',
  'La Libellule de lâ€™illusion',
];

const NATURE_NAMES = [
  'Le Feu du renouveau',
  'Lâ€™Eau des profondeurs',
  'Le Vent des montagnes',
  'La Terre-mère',
  'La Forêt vivante',
  'La Rivière sacrée',
  'Le Soleil guérisseur',
  'La Lune des cycles',
  'Lâ€™Orage purificateur',
  'La Neige silencieuse',
  'Le Désert des visions',
  'La Pluie nourricière',
  'Lâ€™Arbre aux ancêtres',
  'La Caverne des esprits',
  'Le Rocher du souvenir',
];

const PLANTE_NAMES = [
  'La Sauge blanche',
  'Le Cèdre purifiant',
  'Le Tabac sacré',
  'Le Maïs doré',
  'La Citrouille nourricière',
  'Le Haricot de sagesse',
  'Lâ€™Aloe médicinale',
  'Lâ€™Amarante rouge',
  'La Mandragore',
  'Le Peyotl',
  'Le Copal fumigène',
  'Lâ€™Achillée guérisseuse',
  'Le Foin dâ€™odeur',
  'Le Nénuphar lunaire',
  'Le Thé du Labrador',
];

const ESPRIT_NAMES = [
  'Le Grand Esprit',
  'La Femme Bison Blanc',
  'Lâ€™Esprit du Tambour',
  'Lâ€™Ancêtre silencieux',
  'Lâ€™Enfant de lumière',
  'Lâ€™Ombre intérieure',
  'Le Rêveur du ciel',
  'Lâ€™Observateur invisible',
  'Lâ€™Esprit du Feu',
  'Lâ€™ÃŠtre-Aigle',
  'Le Cheval sans bride',
  'Lâ€™Esprit des quatre vents',
  'Le Porteur de Plume',
  'Le Veilleur du crépuscule',
  'La Danse de lâ€™Ã‚me',
];

const PAROLE_NAMES = [
  'â€œÃ‰coute le vent, il te parleâ€',
  'â€œNous sommes les gardiens de la Terreâ€',
  'â€œChaque pas est une prièreâ€',
  'â€œTon cÅ“ur connaît le cheminâ€',
  'â€œTout est liéâ€',
  'â€œLe silence est la voix des Anciensâ€',
  'â€œLa vérité est dans le cercleâ€',
  'â€œRespecte ce que tu ne comprends pasâ€',
  'â€œTu es une étincelle du grand feuâ€',
  'â€œMarche en beautéâ€',
  'â€œLe tambour bat pour tousâ€',
  'â€œLes plumes tombent, mais lâ€™esprit sâ€™élèveâ€',
  'â€œLe rêve enseigne mieux que la paroleâ€',
  'â€œNâ€™oublie jamais dâ€™où tu viensâ€',
  'â€œLe monde est un miroir sacréâ€',
];

const NATION_NAMES = [
  'Hopi â€“ Les gardiens du temps',
  'Navajo â€“ Les tisseurs de lumière',
  'Lakota â€“ Le peuple du bison',
  'Cherokee â€“ Ceux qui marchent avec sagesse',
  'Inuit â€“ Les enfants de la glace',
  'Haïda â€“ Les sculpteurs de totems',
  'Mapuche â€“ Les enfants de la Terre du Sud',
  'Tupi â€“ Les esprits des forêts tropicales',
  'Quechua â€“ Les bâtisseurs des Andes',
  'Arawak â€“ Les rêveurs des îles',
  'Apache â€“ Les guerriers du désert',
  'Algonquin â€“ Les voix de la rivière',
  'Zuni â€“ Les protecteurs des anciens savoirs',
  'Guarani â€“ Les porteurs de chants',
  'Ojibwé â€“ Ceux qui dessinent les rêves',
];

const createThemeCards = (
  theme: CerclesSacresTheme,
  names: string[],
): CerclesSacresCardDefinition[] =>
  names.map((name, index) => ({
    id: `${theme}-${index + 1}`,
    name,
    theme,
  }));

const deck: CerclesSacresCardDefinition[] = [
  ...createThemeCards('totem', TOTEM_NAMES),
  ...createThemeCards('nature', NATURE_NAMES),
  ...createThemeCards('plante', PLANTE_NAMES),
  ...createThemeCards('esprit', ESPRIT_NAMES),
  ...createThemeCards('parole', PAROLE_NAMES),
  ...createThemeCards('nation', NATION_NAMES),
];

export const CERCLES_SACRES_DECK = deck;
export const CERCLES_SACRES_CARD_BY_ID = Object.fromEntries(
  deck.map((card) => [card.id, card]),
);

