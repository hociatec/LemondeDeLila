export type LesMainsFamily =
  | 'tradition'
  | 'nature'
  | 'mer'
  | 'art'
  | 'insolites'
  | 'innovation'
  | 'sante';

export type LesMainsCardType = 'metier' | 'special';

export interface LesMainsCardDefinition {
  id: string;
  name: string;
  type: LesMainsCardType;
  family?: LesMainsFamily;
}

const familyCards: Record<LesMainsFamily, string[]> = {
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

const mainCards: LesMainsCardDefinition[] = Object.entries(familyCards).flatMap(
  ([family, identifiers]) =>
    identifiers.map((id) => ({
      id: `metier-${id}`,
      name: id.replace(/-/g, ' '),
      type: 'metier' as const,
      family: family as LesMainsFamily,
    })),
);

const specialCards: LesMainsCardDefinition[] = [
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

export const LES_MAINS_METIER_CARDS = mainCards;
export const LES_MAINS_SPECIAL_CARDS = specialCards;
export const LES_MAINS_DECK = [...mainCards, ...specialCards];
export const LES_MAINS_CARD_BY_ID: Record<string, LesMainsCardDefinition> =
  Object.fromEntries(LES_MAINS_DECK.map((card) => [card.id, card]));

export const LES_MAINS_FAMILY_SIZE = 6;
export const LES_MAINS_FAMILIES: LesMainsFamily[] = [
  'tradition',
  'nature',
  'mer',
  'art',
  'insolites',
  'innovation',
  'sante',
];
export const LES_MAINS_SPECIAL_CARD_IDS = new Set(
  specialCards.map((card) => card.id),
);
export const isLesMainsSpecialCard = (cardId: string): boolean =>
  LES_MAINS_SPECIAL_CARD_IDS.has(cardId);
