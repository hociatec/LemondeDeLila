import {
  defineEffectRecipe,
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import data from './content-data.json';

export type LaGrandeMineCategory =
  'tresor' | 'objet' | 'event' | 'monster' | 'collapse';

export interface LaGrandeMineCard {
  id: string;
  name: string;
  category: LaGrandeMineCategory;
  description: string;
  points?: number | null;
  effects: readonly GameEffectInstruction[];
}

type RawLaGrandeMineCard = Omit<LaGrandeMineCard, 'effects'>;

const categories: LaGrandeMineCategory[] = [
  'tresor',
  'objet',
  'event',
  'monster',
  'collapse',
];

function category(value: string): LaGrandeMineCategory {
  const found = categories.find((candidate) => candidate === value);
  if (!found) rejectContent(`Catégorie Grande Mine inconnue: ${value}`);
  return found;
}

const drawPassiveAndSteal = defineEffectRecipe((count: number) => [
  gameEffects.custom('mine.draw-passive', { count }),
  gameEffects.stealCard({
    handId: 'players',
    from: gameEffects.target.self(),
    to: gameEffects.target.randomOpponent(),
  }),
]);

const EVENT_EFFECTS: Readonly<
  Record<string, readonly GameEffectInstruction[]>
> = {
  'barbak-event-1': [gameEffects.extraTurn()],
  'barbak-event-2': [
    gameEffects.discardCards({ deckId: 'mine', handId: 'players', count: 1 }),
  ],
  'barbak-event-5': [gameEffects.custom('mine.recover-discard')],
  'barbak-event-8': [
    gameEffects.discardCards({ deckId: 'mine', handId: 'players', count: 1 }),
    gameEffects.discardCards({
      deckId: 'mine',
      handId: 'players',
      count: 1,
      target: gameEffects.target.allOpponents(),
    }),
  ],
  'barbak-event-9': [gameEffects.skipTurn(1)],
  'barbak-event-10': [
    gameEffects.stealCard({
      handId: 'players',
      from: gameEffects.target.self(),
      to: gameEffects.target.next(),
    }),
  ],
  'barbak-event-11': [
    gameEffects.custom('mine.remove-treasure-all', { count: 1 }),
  ],
  'barbak-event-13': [
    gameEffects.custom('mine.draw-passive', { count: 1 }),
    gameEffects.custom(
      'mine.draw-passive',
      { count: 1 },
      gameEffects.target.allOpponents(),
    ),
  ],
  'barbak-event-14': drawPassiveAndSteal(2),
  'barbak-event-15': [
    gameEffects.addStatus({
      status: 'mine.discard-next-draw',
      scope: 'until-used',
    }),
  ],
  'barbak-event-18': [
    gameEffects.custom('mine.draw-passive', { count: 3 }),
    gameEffects.custom('mine.trim-hand'),
  ],
  'barbak-event-19': [gameEffects.custom('mine.double-next-player')],
  'barbak-event-20': [
    gameEffects.custom(
      'mine.discard-target-hand',
      {},
      gameEffects.target.chosenOpponent('mine.event-target'),
    ),
  ],
  'barbak-event-24': [gameEffects.custom('mine.remove-treasure')],
};

const COLLAPSE_EFFECTS: Readonly<
  Record<string, readonly GameEffectInstruction[]>
> = {
  'barbak-collapse-1': [
    gameEffects.discardCards({
      deckId: 'mine',
      handId: 'players',
      count: 1,
      target: gameEffects.target.allPlayers(),
    }),
  ],
  'barbak-collapse-2': [
    gameEffects.custom('mine.remove-treasure-all', { count: 2 }),
  ],
  'barbak-collapse-3': [gameEffects.custom('mine.finish')],
  'barbak-collapse-4': [gameEffects.custom('mine.finish')],
};

function cardEffects(
  card: RawLaGrandeMineCard,
): readonly GameEffectInstruction[] {
  if (card.category === 'monster') {
    if (card.id === 'barbak-monster-3' || card.id === 'barbak-monster-7') {
      return [gameEffects.custom('mine.remove-domain-all')];
    }
    return [
      gameEffects.custom(
        'mine.remove-domain',
        {},
        gameEffects.target.chosenOpponent('mine.monster-target'),
      ),
    ];
  }
  if (card.category === 'collapse') return COLLAPSE_EFFECTS[card.id] ?? [];
  if (card.category === 'event') return EVENT_EFFECTS[card.id] ?? [];
  return [];
}

export const LA_GRANDE_MINE_CARDS: LaGrandeMineCard[] = data.cards.map(
  (card) => {
    const normalized: RawLaGrandeMineCard = {
      ...card,
      category: category(card.category),
    };
    return { ...normalized, effects: cardEffects(normalized) };
  },
);
export const LA_GRANDE_MINE_CARD_BY_ID = Object.fromEntries(
  LA_GRANDE_MINE_CARDS.map((card) => [card.id, card]),
);

freezeGameContent(LA_GRANDE_MINE_CARDS);
freezeGameContent(LA_GRANDE_MINE_CARD_BY_ID);
