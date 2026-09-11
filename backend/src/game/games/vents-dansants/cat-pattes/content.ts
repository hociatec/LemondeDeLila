import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import {
  cardContent,
  defineGameContent,
  effectContentSchema,
  gameEffects,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import manifest from './manifest.json';

export type CatPattesObstacleType =
  'gamelle' | 'pluie' | 'chien' | 'coussin' | 'sol';
export type CatPattesParadeType =
  'croquettes' | 'rayon' | 'dodo' | 'coussin' | 'saut';
export type CatPattesBotType =
  'reserve' | 'chat-ninja' | 'patte-blindee' | 'passage-star';

type CatPattesCardBase = {
  id: string;
  name: string;
  description?: string;
  effect?: string;
  effects: readonly GameEffectInstruction[];
};
type CatPattesCardKind =
  | {
      type: 'pattes';
      value: number;
      obstacle?: never;
      parade?: never;
      bot?: never;
    }
  | {
      type: 'obstacle';
      obstacle: CatPattesObstacleType;
      value?: never;
      parade?: never;
      bot?: never;
    }
  | {
      type: 'parade';
      parade: CatPattesParadeType;
      value?: never;
      obstacle?: never;
      bot?: never;
    }
  | {
      type: 'bot';
      bot: CatPattesBotType;
      value?: never;
      obstacle?: never;
      parade?: never;
    };
export type CatPattesCardDefinition = CatPattesCardBase & CatPattesCardKind;

const createCopies = (
  prefix: string,
  count: number,
  value: Omit<CatPattesCardBase, 'id'> & CatPattesCardKind,
) =>
  Array.from({ length: count }, (_, index): CatPattesCardDefinition => ({
    id: `${prefix}-${index + 1}`,
    ...value,
  }));

const pattesEffects = (value: number): readonly GameEffectInstruction[] => [
  gameEffects.custom('cat-pattes.move', { value }),
];

const obstacleEffects = (
  obstacle: CatPattesObstacleType,
): readonly GameEffectInstruction[] => [
  gameEffects.addStatus({
    status: 'cat-pattes.obstacle',
    scope: 'round',
    data: { obstacle },
    target: gameEffects.target.chosenOpponent('cat-pattes.obstacle'),
  }),
  gameEffects.completeTurn(),
];

const paradeEffects = (
  parade: CatPattesParadeType,
): readonly GameEffectInstruction[] => [
  gameEffects.custom('cat-pattes.parade', { parade }),
  gameEffects.completeTurn(),
];

const powerEffects = (
  power: CatPattesBotType,
): readonly GameEffectInstruction[] => [
  gameEffects.custom('cat-pattes.power', { power }),
];

const deck: CatPattesCardDefinition[] = [
  ...createCopies('pattes-10', 6, {
    type: 'pattes',
    name: 'Pas feutré',
    description: 'Un mouvement discret, précis, presque invisible.',
    effect: 'Vous avancez de 10 pattes.',
    value: 10,
    effects: pattesEffects(10),
  }),
  ...createCopies('pattes-20', 10, {
    type: 'pattes',
    name: 'Petite foulée',
    description: 'Avancer tranquillement, la queue bien droite.',
    effect: 'Vous progressez de 20 pattes.',
    value: 20,
    effects: pattesEffects(20),
  }),
  ...createCopies('pattes-50', 10, {
    type: 'pattes',
    name: 'Sprint du matin',
    description: "Votre chat déborde d'énergie pour l'instant.",
    effect: 'Vous vous élancez de 50 pattes.',
    value: 50,
    effects: pattesEffects(50),
  }),
  ...createCopies('pattes-80', 10, {
    type: 'pattes',
    name: 'Course-poursuite',
    description: 'Quelque chose a bougé. Il faut foncer.',
    effect: 'Vous bondissez de 80 pattes.',
    value: 80,
    effects: pattesEffects(80),
  }),
  ...createCopies('pattes-130', 12, {
    type: 'pattes',
    name: 'Chasse à la souris',
    description: 'Concentration maximale. Objectif en vue.',
    effect: 'Vous foncez sur 130 pattes.',
    value: 130,
    effects: pattesEffects(130),
  }),
  ...createCopies('pattes-150', 4, {
    type: 'pattes',
    name: 'Turbochat',
    description: "Quand tout s'aligne: vitesse, instinct et panache.",
    effect: 'Vous vous déchaînez sur 150 pattes.',
    value: 150,
    effects: pattesEffects(150),
  }),
  ...createCopies('obstacle-gamelle', 3, {
    type: 'obstacle',
    name: 'Gamelle vide',
    description: "Impossible d'avancer le ventre vide.",
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retire.",
    obstacle: 'gamelle',
    effects: obstacleEffects('gamelle'),
  }),
  ...createCopies('obstacle-pluie', 5, {
    type: 'obstacle',
    name: 'Pluie torrentielle',
    description: 'Tout est mouillé, glissant, et franchement désagréable.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'pluie',
    effects: obstacleEffects('pluie'),
  }),
  ...createCopies('obstacle-chien', 3, {
    type: 'obstacle',
    name: 'Chien enragé',
    description: 'Beaucoup trop enthousiaste. Beaucoup trop proche.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'chien',
    effects: obstacleEffects('chien'),
  }),
  ...createCopies('obstacle-coussin', 3, {
    type: 'obstacle',
    name: 'Coussin piégé',
    description: "Il avait l'air confortable, erreur fatale.",
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'coussin',
    effects: obstacleEffects('coussin'),
  }),
  ...createCopies('obstacle-sol', 4, {
    type: 'obstacle',
    name: 'Sol ciré',
    description: 'Vos pattes partent toutes seules, mais pas dans le bon sens.',
    effect: "Bloque les cartes Pattes tant que l'obstacle n'est pas retiré.",
    obstacle: 'sol',
    effects: obstacleEffects('sol'),
  }),
  ...createCopies('parade-croquettes', 6, {
    type: 'parade',
    name: 'Croquettes',
    description: "Un plein d'énergie instantané.",
    effect: 'Retire Gamelle vide.',
    parade: 'croquettes',
    effects: paradeEffects('croquettes'),
  }),
  ...createCopies('parade-rayon', 14, {
    type: 'parade',
    name: 'Rayon de soleil',
    description: 'Indispensable pour démarrer ou repartir du bon pied.',
    effect: 'Active le soleil. Retire Pluie torrentielle.',
    parade: 'rayon',
    effects: paradeEffects('rayon'),
  }),
  ...createCopies('parade-dodo', 6, {
    type: 'parade',
    name: 'Dodo réparateur',
    description: 'Un petit somme, et tout va mieux.',
    effect: 'Retire Chien enragé.',
    parade: 'dodo',
    effects: paradeEffects('dodo'),
  }),
  ...createCopies('parade-coussin', 6, {
    type: 'parade',
    name: 'Nouveau coussin',
    description: 'Celui-ci est sûr. Normalement.',
    effect: 'Retire Coussin piégé.',
    parade: 'coussin',
    effects: paradeEffects('coussin'),
  }),
  ...createCopies('parade-saut', 6, {
    type: 'parade',
    name: 'Saut agile',
    description: 'Une pirouette bien placée règle beaucoup de problèmes.',
    effect: 'Retire Sol ciré.',
    parade: 'saut',
    effects: paradeEffects('saut'),
  }),
  {
    id: 'bot-reserve',
    type: 'bot',
    name: 'Réserve secrète',
    description: 'Plus jamais à court de croquettes.',
    effect: 'Ignore Gamelle vide.',
    bot: 'reserve',
    effects: powerEffects('reserve'),
  },
  {
    id: 'bot-chat-ninja',
    type: 'bot',
    name: 'Chat Ninja',
    description: 'Les chiens ? Quels chiens ?',
    effect: 'Ignore Chien enragé.',
    bot: 'chat-ninja',
    effects: powerEffects('chat-ninja'),
  },
  {
    id: 'bot-patte-blindee',
    type: 'bot',
    name: 'Patte blindée',
    description: 'Les pièges ne font plus peur.',
    effect: 'Ignore Coussin piégé.',
    bot: 'patte-blindee',
    effects: powerEffects('patte-blindee'),
  },
  {
    id: 'bot-passage-star',
    type: 'bot',
    name: 'Passage de star',
    description: 'Toujours prioritaire. Toujours prêt. Toujours stylé.',
    effect: 'Ignore Pluie torrentielle et Sol ciré, et joue sans soleil.',
    bot: 'passage-star',
    effects: powerEffects('passage-star'),
  },
];

const deckSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),

      description: gameInput.optional(gameInput.string({ max: 2000 })),
      effect: gameInput.optional(gameInput.string({ max: 2000 })),
      type: gameInput.enum(['pattes', 'obstacle', 'parade', 'bot']),
      value: gameInput.optional(
        gameInput.number({ integer: true, min: 1, max: 1000 }),
      ),
      obstacle: gameInput.optional(
        gameInput.enum(['gamelle', 'pluie', 'chien', 'coussin', 'sol']),
      ),
      parade: gameInput.optional(
        gameInput.enum(['croquettes', 'rayon', 'dodo', 'coussin', 'saut']),
      ),
      bot: gameInput.optional(
        gameInput.enum([
          'reserve',
          'chat-ninja',
          'patte-blindee',
          'passage-star',
        ]),
      ),
      effects: effectContentSchema({
        effects: ['cat-pattes.move', 'cat-pattes.parade', 'cat-pattes.power'],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const CAT_PATTES_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: deck },
  {
    schema: {
      parse(value: unknown) {
        const parsed = deckSchema.parse(value);

        const cards = parsed.cards.map((card): CatPattesCardDefinition => {
          const { type, value, obstacle, parade, bot, ...base } = card;
          switch (type) {
            case 'pattes':
              if (value === undefined || obstacle || parade || bot)
                rejectContent('Carte Pattes invalide');
              return { ...base, type, value };
            case 'obstacle':
              if (!obstacle || value !== undefined || parade || bot)
                rejectContent('Carte Obstacle invalide');
              return { ...base, type, obstacle };
            case 'parade':
              if (!parade || value !== undefined || obstacle || bot)
                rejectContent('Carte Parade invalide');
              return { ...base, type, parade };
            case 'bot':
              if (!bot || value !== undefined || obstacle || parade)
                rejectContent('Carte Pouvoir invalide');
              return { ...base, type, bot };
          }
        });
        return { cards: cardContent(cards) };
      },
    },
  },
);
export const CAT_PATTES_DECK = CAT_PATTES_GAME_CONTENT.data.cards;
export const CAT_PATTES_CARD_BY_ID: Readonly<
  Record<string, CatPattesCardDefinition>
> = Object.freeze(
  Object.fromEntries(CAT_PATTES_DECK.map((card) => [card.id, card])),
);
export const CAT_PATTES_GOAL = 1000;
export const CAT_PATTES_DEFAULT_ROUNDS = 3;
