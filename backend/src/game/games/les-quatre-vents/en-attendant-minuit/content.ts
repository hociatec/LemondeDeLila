import { freezeGameContent, gameEffects } from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import { MINUIT_TILES } from './board';
export { MINUIT_TILES, type MinuitTile, type MinuitTileType } from './board';

export type MinuitCardEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'roll' }
  | { kind: 'shield-malus' }
  | { kind: 'next-card' }
  | { kind: 'replay' }
  | { kind: 'gift' }
  | { kind: 'shield-skip' }
  | { kind: 'swap' }
  | { kind: 'skip'; turns: number }
  | { kind: 'previous-card' }
  | { kind: 'force-draw' }
  | { kind: 'swap-behind' }
  | { kind: 'move-others'; delta: number }
  | { kind: 'previous-neutral' };

import { QUIZ_CARDS, type MinuitQuiz } from './quiz-content';
export type { MinuitQuiz } from './quiz-content';

export type MinuitCard = {
  id: number;
  title: string;
  effects: readonly GameEffectInstruction[];
  quiz?: MinuitQuiz;
};

type StandardCardDefinition = Omit<MinuitCard, 'effects' | 'quiz'> & {
  effect: MinuitCardEffect;
};

const STANDARD_CARDS: StandardCardDefinition[] = [
  { id: 1, title: 'Traîneau miniature', effect: { kind: 'move', delta: 3 } },
  { id: 2, title: 'Bonnet du Père Noël', effect: { kind: 'roll' } },
  { id: 3, title: 'Chocolat magique', effect: { kind: 'move', delta: 2 } },
  { id: 4, title: 'Gant chauffant', effect: { kind: 'shield-malus' } },
  { id: 5, title: 'Luge de vitesse', effect: { kind: 'next-card' } },
  { id: 6, title: 'Sac à jouets', effect: { kind: 'replay' } },
  { id: 7, title: 'Chaussures de lutin', effect: { kind: 'move', delta: 4 } },
  { id: 8, title: 'Cadeau-surprise', effect: { kind: 'gift' } },
  { id: 9, title: 'Écharpe magique', effect: { kind: 'shield-skip' } },
  { id: 10, title: 'Baguette des fées', effect: { kind: 'swap' } },
  { id: 11, title: 'Lettre bien rédigée', effect: { kind: 'move', delta: 6 } },
  { id: 12, title: 'Bougie de l’Avent', effect: { kind: 'move', delta: 2 } },
  { id: 13, title: 'Bonnet envolé', effect: { kind: 'move', delta: -2 } },
  { id: 14, title: 'Étoile filante', effect: { kind: 'move', delta: 1 } },
  { id: 15, title: 'Bonhomme joueur', effect: { kind: 'skip', turns: 1 } },
  { id: 16, title: 'Dessin d’enfant', effect: { kind: 'move', delta: 2 } },
  { id: 17, title: 'Renne enrhumé', effect: { kind: 'move', delta: -1 } },
  {
    id: 18,
    title: 'Guirlande facétieuse',
    effect: { kind: 'move', delta: -2 },
  },
  { id: 19, title: 'Chocolat chaud', effect: { kind: 'move', delta: 1 } },
  { id: 20, title: 'Cadeau perdu', effect: { kind: 'skip', turns: 2 } },
  { id: 21, title: 'Carte de vœux', effect: { kind: 'replay' } },
  { id: 22, title: 'Labyrinthe de sucre', effect: { kind: 'previous-card' } },
  { id: 23, title: 'Chant d’enfants', effect: { kind: 'move', delta: 2 } },
  { id: 24, title: 'Traîneau bloqué', effect: { kind: 'skip', turns: 1 } },
  { id: 25, title: 'Panneaux échangés', effect: { kind: 'move', delta: -3 } },
  { id: 26, title: 'Dé caché', effect: { kind: 'force-draw' } },
  {
    id: 27,
    title: 'Farce dans les bottes',
    effect: { kind: 'skip', turns: 1 },
  },
  { id: 28, title: 'Glissade provoquée', effect: { kind: 'move', delta: -2 } },
  { id: 29, title: 'Faux cadeau', effect: { kind: 'move', delta: -1 } },
  { id: 30, title: 'Avancée volée', effect: { kind: 'swap-behind' } },
  { id: 31, title: 'Lutin farceur', effect: { kind: 'skip', turns: 1 } },
  { id: 32, title: 'Moustache en sucre', effect: { kind: 'skip', turns: 2 } },
  { id: 33, title: 'Danse de lutins', effect: { kind: 'skip', turns: 3 } },
  {
    id: 34,
    title: 'Chapeau de clown',
    effect: { kind: 'move-others', delta: 1 },
  },
  { id: 35, title: 'Sapin surprise', effect: { kind: 'move', delta: -2 } },
  { id: 36, title: 'Chemin embrouillé', effect: { kind: 'previous-neutral' } },
];

export const MINUIT_CARDS: MinuitCard[] = [
  ...STANDARD_CARDS.map((card) => ({
    id: card.id,
    title: card.title,
    effects: standardInstructions(card.effect),
  })),
  ...QUIZ_CARDS.map((card) => ({
    id: card.id,
    title: card.title,
    effects: [],
    quiz: card.quiz,
  })),
];

function standardInstructions(
  effect: MinuitCardEffect,
): readonly GameEffectInstruction[] {
  const statusInstructions = persistentStatusInstructions(effect);
  if (statusInstructions) return statusInstructions;
  if (effect.kind === 'move') {
    return [gameEffects.custom('minuit.move', { delta: effect.delta })];
  }
  if (effect.kind === 'roll') return [gameEffects.custom('minuit.roll')];
  if (effect.kind === 'next-card') {
    return [
      gameEffects.custom('minuit.move-to-type', {
        type: 'card',
        direction: 'forward',
      }),
    ];
  }
  if (effect.kind === 'replay') return [gameEffects.extraTurn()];
  if (effect.kind === 'gift') {
    return [
      gameEffects.custom(
        'minuit.gift',
        {},
        gameEffects.target.chosenOpponent('minuit.gift'),
      ),
      gameEffects.completeTurn(),
    ];
  }
  if (effect.kind === 'swap') {
    return [
      gameEffects.custom(
        'minuit.swap',
        {},
        gameEffects.target.chosenOpponent('minuit.swap', true),
      ),
      gameEffects.completeTurn(),
    ];
  }
  if (effect.kind === 'skip') return [gameEffects.skipTurn(effect.turns)];
  if (effect.kind === 'previous-card') {
    return [
      gameEffects.custom('minuit.move-to-type', {
        type: 'card',
        direction: 'backward',
      }),
    ];
  }
  if (effect.kind === 'swap-behind') {
    return [gameEffects.custom('minuit.swap-behind')];
  }
  if (effect.kind === 'move-others') {
    return [
      gameEffects.move(
        'minuit',
        effect.delta,
        gameEffects.target.allOpponents(),
      ),
    ];
  }
  return [
    gameEffects.custom('minuit.move-to-type', {
      type: 'neutral',
      direction: 'backward',
    }),
  ];
}

function persistentStatusInstructions(
  effect: MinuitCardEffect,
): readonly GameEffectInstruction[] | null {
  const status =
    effect.kind === 'shield-malus'
      ? 'minuit.ignore-next-malus'
      : effect.kind === 'shield-skip'
        ? 'minuit.ignore-next-skip'
        : effect.kind === 'force-draw'
          ? 'minuit.force-draw-next-turn'
          : null;
  return status
    ? [gameEffects.addStatus({ status, scope: 'until-used' })]
    : null;
}

export const MINUIT_PAWNS = [
  { id: 'lutin', name: 'Le Lutin' },
  { id: 'bonhomme-de-neige', name: 'Le Bonhomme de Neige' },
  { id: 'fee-des-flocons', name: 'La Fée des Flocons' },
  { id: 'pere-noel', name: 'Le Père Noël' },
  { id: 'renne', name: 'Le Renne' },
  { id: 'bonhomme-pain-epices', name: 'Le Petit Bonhomme en Pain d’Épices' },
] as const;

freezeGameContent(MINUIT_TILES);
freezeGameContent(MINUIT_CARDS);
freezeGameContent(MINUIT_PAWNS);
