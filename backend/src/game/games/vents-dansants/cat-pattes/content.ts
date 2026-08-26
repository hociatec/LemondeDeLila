export type CatPattesCardType = 'pattes' | 'obstacle' | 'parade' | 'bot';

export type CatPattesObstacleType =
  | 'gamelle'
  | 'pluie'
  | 'chien'
  | 'coussin'
  | 'sol';
export type CatPattesParadeType =
  | 'croquettes'
  | 'rayon'
  | 'dodo'
  | 'coussin'
  | 'saut';
export type CatPattesBotType =
  | 'reserve'
  | 'chat-ninja'
  | 'patte-blindee'
  | 'passage-star';

export interface CatPattesCardDefinition {
  id: string;
  name: string;
  description?: string;
  effect?: string;
  type: CatPattesCardType;
  value?: number;
  obstacle?: CatPattesObstacleType;
  parade?: CatPattesParadeType;
  bot?: CatPattesBotType;
}

const createCopies = (
  prefix: string,
  count: number,
  value: Partial<CatPattesCardDefinition>,
) =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `${prefix}-${index + 1}`,
        ...value,
      }) as CatPattesCardDefinition,
  );

const deck: CatPattesCardDefinition[] = [
  ...createCopies('pattes-10', 6, {
    type: 'pattes',
    name: 'Pas feutré',
    description: 'Un mouvement discret, précis, presque invisible.',
    effect: 'Vous avancez de 10 pattes.',
    value: 10,
  }),
  ...createCopies('pattes-20', 10, {
    type: 'pattes',
    name: 'Petite foulée',
    description: 'Avancer tranquillement, la queue bien droite.',
    effect: 'Vous progressez de 20 pattes.',
    value: 20,
  }),
  ...createCopies('pattes-50', 10, {
    type: 'pattes',
    name: 'Sprint du matin',
    description: "Votre chat déborde d'énergie pour l'instant.",
    effect: 'Vous vous élancez de 50 pattes.',
    value: 50,
  }),
  ...createCopies('pattes-80', 10, {
    type: 'pattes',
    name: 'Course-poursuite',
    description: 'Quelque chose a bougé. Il faut foncer.',
    effect: 'Vous bondissez de 80 pattes.',
    value: 80,
  }),
  ...createCopies('pattes-130', 12, {
    type: 'pattes',
    name: 'Chasse à la souris',
    description: 'Concentration maximale. Objectif en vue.',
    effect: 'Vous foncez sur 130 pattes.',
    value: 130,
  }),
  ...createCopies('pattes-150', 4, {
    type: 'pattes',
    name: 'Turbochat',
    description: "Quand tout s'aligne: vitesse, instinct et panache.",
    effect: 'Vous vous déchaînez sur 150 pattes.',
    value: 150,
  }),
  ...createCopies('obstacle-gamelle', 3, {
    type: 'obstacle',
    name: 'Gamelle vide',
    description: "Impossible d'avancer le ventre vide.",
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retire.",
    obstacle: 'gamelle',
  }),
  ...createCopies('obstacle-pluie', 5, {
    type: 'obstacle',
    name: 'Pluie torrentielle',
    description: 'Tout est mouillé, glissant, et franchement désagréable.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'pluie',
  }),
  ...createCopies('obstacle-chien', 3, {
    type: 'obstacle',
    name: 'Chien enragé',
    description: 'Beaucoup trop enthousiaste. Beaucoup trop proche.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'chien',
  }),
  ...createCopies('obstacle-coussin', 3, {
    type: 'obstacle',
    name: 'Coussin piégé',
    description: "Il avait l'air confortable, erreur fatale.",
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'coussin',
  }),
  ...createCopies('obstacle-sol', 4, {
    type: 'obstacle',
    name: 'Sol ciré',
    description: 'Vos pattes partent toutes seules, mais pas dans le bon sens.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'sol',
  }),
  ...createCopies('parade-croquettes', 6, {
    type: 'parade',
    name: 'Croquettes',
    description: "Un plein d'énergie instantané.",
    effect: 'Retire Gamelle vide.',
    parade: 'croquettes',
  }),
  ...createCopies('parade-rayon', 14, {
    type: 'parade',
    name: 'Rayon de soleil',
    description: 'Indispensable pour démarrer ou repartir du bon pied.',
    effect: 'Active le soleil. Retire Pluie torrentielle.',
    parade: 'rayon',
  }),
  ...createCopies('parade-dodo', 6, {
    type: 'parade',
    name: 'Dodo réparateur',
    description: 'Un petit somme, et tout va mieux.',
    effect: 'Retire Chien enragé.',
    parade: 'dodo',
  }),
  ...createCopies('parade-coussin', 6, {
    type: 'parade',
    name: 'Nouveau coussin',
    description: 'Celui-ci est sûr. Normalement.',
    effect: 'Retire Coussin piégé.',
    parade: 'coussin',
  }),
  ...createCopies('parade-saut', 6, {
    type: 'parade',
    name: 'Saut agile',
    description: 'Une pirouette bien placée règle beaucoup de problèmes.',
    effect: 'Retire Sol ciré.',
    parade: 'saut',
  }),
  {
    id: 'bot-reserve',
    type: 'bot',
    name: 'Réserve secrète',
    description: 'Plus jamais à court de croquettes.',
    effect: 'Ignore Gamelle vide.',
    bot: 'reserve',
  },
  {
    id: 'bot-chat-ninja',
    type: 'bot',
    name: 'Chat Ninja',
    description: 'Les chiens ? Quels chiens ?',
    effect: 'Ignore Chien enragé.',
    bot: 'chat-ninja',
  },
  {
    id: 'bot-patte-blindee',
    type: 'bot',
    name: 'Patte blindée',
    description: 'Les pièges ne font plus peur.',
    effect: 'Ignore Coussin piégé.',
    bot: 'patte-blindee',
  },
  {
    id: 'bot-passage-star',
    type: 'bot',
    name: 'Passage de star',
    description: 'Toujours prioritaire. Toujours prêt. Toujours stylé.',
    effect: 'Ignore Pluie torrentielle et Sol ciré, et joue sans soleil.',
    bot: 'passage-star',
  },
];

export const CAT_PATTES_DECK = deck;
export const CAT_PATTES_CARD_BY_ID: Record<string, CatPattesCardDefinition> =
  Object.fromEntries(deck.map((card) => [card.id, card]));
export const CAT_PATTES_GOAL = 1000;
export const CAT_PATTES_DEFAULT_ROUNDS = 3;
