export type CaTile = {
  label: string;
  description: string;
  isNeutral: boolean;
};

const NEUTRAL_TILES = new Set([0, 2, 7, 10, 13, 17, 20, 23, 26, 28, 29]);
const TILE_NAMES = [
  'Départ',
  'Petit Bosquet',
  'Case Neutre',
  'Petit Pont',
  'Collines Dansantes',
  'Rivière Chantante',
  'Prairie Colorée',
  'Case détente',
  'Monticule Rigolo',
  'Forêt des Chuchotis',
  'Case détente',
  'Racine Taquine',
  'Colline du Hérisson',
  'Case détente',
  'Tourbillon de Feuilles',
  'Pont Suspendu',
  'Petite Mare Mystérieuse',
  'Case détente',
  'Chemin des Fougères',
  'Colline de l’Élan',
  'Case détente',
  'Racine Souriante',
  'Forêt des Murmures',
  'Case détente',
  'Prairie des Papillons',
  'Monticule Secret',
  'Case détente',
  'Pont des Échos',
  'Dernière détente',
  'Arrivée',
] as const;

export const CA_DERAPE_TILES: CaTile[] = TILE_NAMES.map((label, index) => ({
  label,
  description: NEUTRAL_TILES.has(index)
    ? 'Un instant calme sur le parcours.'
    : 'Une carte Situation vous attend.',
  isNeutral: NEUTRAL_TILES.has(index),
}));

export type CaCardKind =
  | 'move'
  | 'skip'
  | 'special'
  | 'global'
  | 'conditional'
  | 'rule'
  | 'neutral';

export type CaCard = {
  id: number;
  title: string;
  text: string;
  kind: CaCardKind;
  moveDelta?: number;
};

const SIMPLE_FORWARD = [1, 2, 1, 2, 3, 2, 3, 2, 3, 1, 2, 3];
const SPECTACULAR_FORWARD = [5, 6, 7, 6, 8, 5, 7, 6];
const PENALTIES: Array<number | 'skip'> = [
  'skip',
  -2,
  'skip',
  -1,
  'skip',
  -3,
  -2,
  -1,
  -3,
  -1,
  'skip',
  -4,
];

const simpleCards: CaCard[] = SIMPLE_FORWARD.map((moveDelta, index) => ({
  id: index + 1,
  title: `Avancée joyeuse ${index + 1}`,
  text: `Avancez de ${moveDelta} case(s).`,
  kind: 'move',
  moveDelta,
}));

const spectacularCards: CaCard[] = SPECTACULAR_FORWARD.map(
  (moveDelta, index) => ({
    id: index + 13,
    title: `Accélération spectaculaire ${index + 1}`,
    text: `Avancez de ${moveDelta} case(s).`,
    kind: 'move',
    moveDelta,
  }),
);

const penaltyCards: CaCard[] = PENALTIES.map((effect, index) => ({
  id: index + 21,
  title: `Dérapage ${index + 1}`,
  text:
    effect === 'skip'
      ? 'Passez un tour.'
      : `Reculez de ${Math.abs(effect)} case(s).`,
  kind: effect === 'skip' ? 'skip' : 'move',
  ...(effect === 'skip' ? {} : { moveDelta: effect }),
}));

const specials: CaCard[] = [
  {
    id: 33,
    title: 'Raccourci Secret',
    text: 'Prenez la première place.',
    kind: 'special',
  },
  {
    id: 34,
    title: 'Cactus Sympathiques',
    text: 'Avancez de 4 et ignorez la prochaine pénalité.',
    kind: 'special',
    moveDelta: 4,
  },
  {
    id: 35,
    title: 'Saute-Mouton',
    text: 'Dépassez le joueur devant et faites-le reculer.',
    kind: 'special',
  },
  {
    id: 36,
    title: 'Saut Quantique',
    text: 'Rejoignez la prochaine case multiple de cinq.',
    kind: 'special',
  },
  {
    id: 37,
    title: 'Chemin de Traverse',
    text: 'Avancez de 3 et rejouez.',
    kind: 'special',
    moveDelta: 3,
  },
  {
    id: 38,
    title: 'Trompe-l’œil',
    text: 'Avancez de 2 puis échangez votre place.',
    kind: 'special',
    moveDelta: 2,
  },
  {
    id: 39,
    title: 'Trappe Bienveillante',
    text: 'Avancez de 5.',
    kind: 'move',
    moveDelta: 5,
  },
  {
    id: 40,
    title: 'Virage Efficace',
    text: 'Avancez de 3.',
    kind: 'move',
    moveDelta: 3,
  },
];

const GLOBAL_TEXTS = [
  'Mélangez toutes les positions.',
  'Inversez l’ordre du classement.',
  'Tout le monde passe un tour.',
  'Tout le monde avance d’une case.',
  'Tout le monde recule de deux cases.',
  'Rien ne se passe.',
  'Tout le monde passe un tour.',
  'Tout le monde avance d’une case.',
  'Décalez toutes les positions.',
  'Tout le monde relance le dé.',
] as const;

const globals: CaCard[] = GLOBAL_TEXTS.map((text, index) => ({
  id: index + 41,
  title: `Chaos ${index + 1}`,
  text,
  kind: index === 5 ? 'neutral' : 'global',
}));

const CONDITIONAL_TEXTS = [
  'Le premier recule de 2, les autres avancent de 2.',
  'Le dernier avance de 3.',
  'Après un recul, avancez de 3.',
  'Annulez un tour à passer.',
  'Sur un multiple de 5, avancez de 4, sinon reculez de 1.',
  'Après deux tours immobile, avancez de 5.',
  'À égalité, avancez tous les deux de 2.',
  'Rejouez immédiatement.',
  'Rejoignez le joueur juste devant.',
  'Après un dépassement d’une case, avancez encore de 1.',
] as const;

const conditionals: CaCard[] = CONDITIONAL_TEXTS.map((text, index) => ({
  id: index + 51,
  title: `Condition ${index + 1}`,
  text,
  kind: 'conditional',
}));

const RULE_TEXTS = [
  'Lancez deux dés et avancez du total.',
  'Piochez une carte supplémentaire.',
  'Votre prochain déplacement est doublé.',
  'Reculez de 3 puis avancez de 2.',
  'Ignorez votre prochain recul.',
  'Avancez de 3 puis reculez de 1.',
  'Choisissez qui joue après vous.',
  'Choisissez +1 ou -1 pour le prochain joueur.',
  'Votre prochain lancer compte double.',
  'Copiez le dernier lancer d’un joueur choisi.',
] as const;

const rules: CaCard[] = RULE_TEXTS.map((text, index) => ({
  id: index + 61,
  title: `Règle idiote ${index + 1}`,
  text,
  kind: 'rule',
}));

const ambiences: CaCard[] = Array.from({ length: 10 }, (_entry, index) => ({
  id: index + 71,
  title: `Ambiance ${index + 1}`,
  text: 'Une parenthèse paisible traverse la course.',
  kind: 'neutral',
}));

export const CA_DERAPE_CARDS: CaCard[] = [
  ...simpleCards,
  ...spectacularCards,
  ...penaltyCards,
  ...specials,
  ...globals,
  ...conditionals,
  ...rules,
  ...ambiences,
];
