import {
  freezeGameContent,
  gameEffects,
} from '../../../core/application/public-api';
import type { GameEffectInstruction } from '../../../core/application/public-api';

export type LesMainsFamily =
  'tradition' | 'nature' | 'mer' | 'art' | 'insolites' | 'innovation' | 'sante';

export type LesMainsCardType = 'metier' | 'special';

export const LES_MAINS_FAMILIES: readonly LesMainsFamily[] = [
  'tradition',
  'nature',
  'mer',
  'art',
  'insolites',
  'innovation',
  'sante',
];

export interface LesMainsCardDefinition {
  id: string;
  name: string;
  type: LesMainsCardType;
  family?: LesMainsFamily;
  effects: readonly GameEffectInstruction[];
}

type RawLesMainsCardDefinition = Omit<LesMainsCardDefinition, 'effects'>;

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

const mainCards: LesMainsCardDefinition[] = LES_MAINS_FAMILIES.flatMap(
  (family) =>
    familyCards[family].map((id) => ({
      id: `metier-${id}`,
      name: id.replace(/-/g, ' '),
      type: 'metier',
      family,
      effects: [],
    })),
);

const rawSpecialCards: RawLesMainsCardDefinition[] = [
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

const SPECIAL_EFFECTS: Readonly<
  Record<string, readonly GameEffectInstruction[]>
> = {
  'special-voyage-autour-du-monde': [
    gameEffects.custom('les-mains.exchange-random'),
  ],
  'special-metier-disparu': [gameEffects.custom('les-mains.complete-vanished')],
  'special-formation-express': [
    gameEffects.gainResource('les-mains.extra-draws', 1),
  ],
  'special-greve-mondiale': [
    gameEffects.skipTurn(1, gameEffects.target.allOpponents()),
  ],
  'special-boussole-perdue': [gameEffects.custom('les-mains.mix-hands')],
  'special-passation-de-savoir': [
    gameEffects.custom('les-mains.pass-knowledge'),
  ],
  'special-fete-du-metier': [
    gameEffects.addStatus({
      status: 'les-mains.free-family-request',
      scope: 'until-used',
    }),
  ],
};

const specialCards: LesMainsCardDefinition[] = rawSpecialCards.map((card) => ({
  ...card,
  effects: [
    ...(SPECIAL_EFFECTS[card.id] ?? []),
    gameEffects.custom('les-mains.log-special', { cardId: card.id }),
  ],
}));

export const LES_MAINS_METIER_CARDS = mainCards;
export const LES_MAINS_SPECIAL_CARDS = specialCards;
export const LES_MAINS_DECK = [...mainCards, ...specialCards];
export const LES_MAINS_CARD_BY_ID: Record<string, LesMainsCardDefinition> =
  Object.fromEntries(LES_MAINS_DECK.map((card) => [card.id, card]));

export const LES_MAINS_FAMILY_SIZE = 6;
export const LES_MAINS_SPECIAL_CARD_IDS = new Set(
  specialCards.map((card) => card.id),
);
export const isLesMainsSpecialCard = (cardId: string): boolean =>
  LES_MAINS_SPECIAL_CARD_IDS.has(cardId);

freezeGameContent(LES_MAINS_METIER_CARDS);
freezeGameContent(LES_MAINS_SPECIAL_CARDS);
freezeGameContent(LES_MAINS_DECK);
freezeGameContent(LES_MAINS_CARD_BY_ID);
freezeGameContent(LES_MAINS_FAMILIES);
freezeGameContent(LES_MAINS_SPECIAL_CARD_IDS);
