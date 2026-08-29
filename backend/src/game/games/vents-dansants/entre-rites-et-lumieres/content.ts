import { freezeGameContent, gameEffects } from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type RiteFamilyId =
  | 'symboles-sacres'
  | 'creatures-de-paques'
  | 'traditions-et-fetes'
  | 'gourmandises-objets'
  | 'nature-saisons';

export type RiteCardType = 'family' | 'special';

export interface RiteFamilyCard {
  id: string;
  type: 'family';
  name: string;
  familyId: RiteFamilyId;
  familyName: string;
}

export interface RiteSpecialCard {
  id: string;
  type: 'special';
  name: string;
  description: string;
  effect: RiteSpecialEffect;
  effects: readonly GameEffectInstruction[];
}

export const RITE_SPECIAL_EFFECTS = [
  'draw_two_choose_one',
  'draw_and_trigger',
  'collect_from_others',
  'take_from_discard',
  'mute_specials',
  'swap_hands',
  'free_family',
  'reshuffle_cycle',
  'peace_turns',
  'reveal_and_steal',
] as const;
export type RiteSpecialEffect = (typeof RITE_SPECIAL_EFFECTS)[number];
type RawRiteSpecialCard = Omit<RiteSpecialCard, 'effects'>;

export type RiteCardDefinition = RiteFamilyCard | RiteSpecialCard;

const FAMILY_DEFINITIONS: {
  id: RiteFamilyId;
  name: string;
  members: string[];
}[] = [
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
      'Le Tombeau Vide',
    ],
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
      'Le Lièvre Blanc',
    ],
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
      'La Veillée Pascale',
    ],
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
      'Dragées multicolores',
    ],
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
      'Champ fleuri',
    ],
  },
];

export const ENTRE_RITES_FAMILY_IDS = FAMILY_DEFINITIONS.map(
  (family) => family.id,
);

const RAW_SPECIALS: RawRiteSpecialCard[] = [
  {
    id: 'lapin-d-or',
    type: 'special',
    name: 'Le Lapin d’Or',
    description:
      'Piochez deux cartes. Choisissez-en une pour votre main et ajoutez-la immédiatement ; l’autre va dans la défausse.',
    effect: 'draw_two_choose_one',
  },
  {
    id: 'oeuf-surprise',
    type: 'special',
    name: 'L’Œuf Surprise',
    description:
      'Piochez une carte supplémentaire et appliquez immédiatement son effet caché.',
    effect: 'draw_and_trigger',
  },
  {
    id: 'benediction',
    type: 'special',
    name: 'La Bénédiction',
    description:
      'Tous les autres joueurs vous offrent une carte de leur choix.',
    effect: 'collect_from_others',
  },
  {
    id: 'resurrection',
    type: 'special',
    name: 'La Résurrection',
    description:
      'Reprenez une carte depuis la défausse et ajoutez-la dans votre main pour rejouer.',
    effect: 'take_from_discard',
  },
  {
    id: 'silence-sacre',
    type: 'special',
    name: 'Le Silence Sacré',
    description:
      'Les effets spéciaux sont annulés jusqu’à votre prochain tour (aucun effet automatisé ne peut être déclenché).',
    effect: 'mute_specials',
  },
  {
    id: 'envol-mystique',
    type: 'special',
    name: 'L’Envol Mystique',
    description: 'Échangez toutes vos cartes avec celles d’un autre joueur.',
    effect: 'swap_hands',
  },
  {
    id: 'cle-jardin',
    type: 'special',
    name: 'La Clé du Jardin Caché',
    description:
      'Posez trois cartes issues de familles différentes comme si elles formaient une famille complète.',
    effect: 'free_family',
  },
  {
    id: 'aube-nouvelle',
    type: 'special',
    name: 'L’Aube Nouvelle',
    description: 'Chaque joueur défausse une carte puis pioche deux cartes.',
    effect: 'reshuffle_cycle',
  },
  {
    id: 'etoile-orient',
    type: 'special',
    name: 'L’Étoile de l’Orient',
    description:
      'Personne ne peut demander de cartes ni jouer de pouvoirs pendant deux tours.',
    effect: 'peace_turns',
  },
  {
    id: 'chant-coq',
    type: 'special',
    name: 'Le Chant du Coq',
    description:
      'Chaque joueur révèle sa main et vous pouvez choisir une carte révélée.',
    effect: 'reveal_and_steal',
  },
];

const self = gameEffects.target.self();
const SPECIAL_INSTRUCTIONS: Readonly<
  Record<RiteSpecialEffect, readonly GameEffectInstruction[]>
> = {
  draw_two_choose_one: [gameEffects.custom('rites.draw-two', {}, self)],
  draw_and_trigger: [gameEffects.custom('rites.draw-one', {}, self)],
  collect_from_others: [gameEffects.custom('rites.collect', {}, self)],
  take_from_discard: [gameEffects.custom('rites.resurrect', {}, self)],
  mute_specials: [
    gameEffects.addStatus({
      status: 'rites.silence',
      scope: 'until-used',
      target: self,
    }),
  ],
  swap_hands: [
    gameEffects.swapHands(
      'players',
      self,
      gameEffects.target.chosenOpponent('rites.swap-hands'),
    ),
    gameEffects.completeTurn(),
  ],
  free_family: [gameEffects.custom('rites.free-family', {}, self)],
  reshuffle_cycle: [gameEffects.custom('rites.dawn-cycle', {}, self)],
  peace_turns: [
    gameEffects.addStatus({
      status: 'rites.peace',
      turns: 2,
      scope: 'global-turn',
      target: self,
    }),
  ],
  reveal_and_steal: [gameEffects.custom('rites.steal-choice', {}, self)],
};

const SPECIALS: RiteSpecialCard[] = RAW_SPECIALS.map((card) => ({
  ...card,
  effects: SPECIAL_INSTRUCTIONS[card.effect],
}));

const createFamilyCards = (): RiteFamilyCard[] => {
  const cards: RiteFamilyCard[] = [];
  for (const family of FAMILY_DEFINITIONS) {
    family.members.forEach((member, index) => {
      cards.push({
        id: `${family.id}-${index + 1}`,
        type: 'family',
        name: member,
        familyId: family.id,
        familyName: family.name,
      });
    });
  }
  return cards;
};

export const ENTRE_RITES_FAMILY_CARDS = createFamilyCards();
export const ENTRE_RITES_SPECIAL_CARDS = SPECIALS;
export const ENTRE_RITES_DECK: RiteCardDefinition[] = [
  ...ENTRE_RITES_FAMILY_CARDS,
  ...ENTRE_RITES_SPECIAL_CARDS,
];
export const ENTRE_RITES_CUSTOM_FAMILY_SIZE = FAMILY_DEFINITIONS.reduce<
  Record<RiteFamilyId, number>
>(
  (sizes, family) => {
    sizes[family.id] = family.members.length;
    return sizes;
  },
  {
    'symboles-sacres': 0,
    'creatures-de-paques': 0,
    'traditions-et-fetes': 0,
    'gourmandises-objets': 0,
    'nature-saisons': 0,
  },
);

export const ENTRE_RITES_CARD_BY_ID = Object.fromEntries(
  ENTRE_RITES_DECK.map((card) => [card.id, card]),
);

freezeGameContent(ENTRE_RITES_FAMILY_CARDS);
freezeGameContent(ENTRE_RITES_SPECIAL_CARDS);
freezeGameContent(ENTRE_RITES_DECK);
freezeGameContent(ENTRE_RITES_CUSTOM_FAMILY_SIZE);
freezeGameContent(ENTRE_RITES_CARD_BY_ID);
