import {
  freezeGameContent,
  gameEffects,
} from '../../../core/application/public-api';
import type { GameEffectInstruction } from '../../../core/application/public-api';

export type MinuitTileType =
  'start' | 'neutral' | 'card' | 'move' | 'skip' | 'finish';

export type MinuitTile = {
  n: number;
  title: string;
  type: MinuitTileType;
  delta: number;
  skipTurns: number;
};

const CARD_TILES = new Set([
  2, 6, 10, 13, 16, 21, 24, 28, 31, 35, 38, 41, 45, 48, 51,
]);
const SKIP_TILES = new Set([7, 12, 25, 39, 49]);
const MOVE_BY_TILE: Record<number, number> = {
  3: 3,
  5: -1,
  18: -3,
  19: 2,
  26: 1,
  29: -1,
  32: -2,
  36: 2,
  44: -1,
  47: 1,
};

export const MINUIT_TILES: MinuitTile[] = Array.from(
  { length: 56 },
  (_entry, index) => {
    const type: MinuitTileType =
      index === 0
        ? 'start'
        : index === 55
          ? 'finish'
          : CARD_TILES.has(index)
            ? 'card'
            : SKIP_TILES.has(index)
              ? 'skip'
              : MOVE_BY_TILE[index] != null
                ? 'move'
                : 'neutral';
    return {
      n: index + 1,
      title:
        type === 'start'
          ? 'Village du Père Noël'
          : type === 'finish'
            ? 'La Grande Fête de Noël'
            : type === 'card'
              ? 'Carte Noël'
              : type === 'skip'
                ? 'Obstacle de Noël'
                : type === 'move'
                  ? 'Événement de Noël'
                  : 'Chemin enneigé',
      type,
      delta: MOVE_BY_TILE[index] ?? 0,
      skipTurns: type === 'skip' ? 1 : 0,
    };
  },
);

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

export type MinuitQuiz = {
  prompt: string;
  choices: [string, string, string];
  correctIndex: number;
  successDelta: number;
  failureDelta: number;
  anyCorrect?: boolean;
};

export type MinuitCard = {
  id: number;
  title: string;
  effects: readonly GameEffectInstruction[];
  quiz?: MinuitQuiz;
};

type StandardCardDefinition = Omit<MinuitCard, 'effects' | 'quiz'> & {
  effect: MinuitCardEffect;
};

type QuizCardDefinition = Omit<MinuitCard, 'effects' | 'quiz'> & {
  quiz: MinuitQuiz;
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

const quiz = (
  id: number,
  title: string,
  prompt: string,
  choices: [string, string, string],
  correctIndex: number,
  successDelta: number,
  failureDelta: number,
  anyCorrect = false,
): QuizCardDefinition => ({
  id,
  title,
  quiz: {
    prompt,
    choices,
    correctIndex,
    successDelta,
    failureDelta,
    ...(anyCorrect ? { anyCorrect: true } : {}),
  },
});

const QUIZ_CARDS: QuizCardDefinition[] = [
  quiz(
    37,
    'Petit Papa Noël',
    'Quelle est la deuxième phrase ?',
    ['Il me tarde tant', 'Quand tu descendras du ciel', 'Avec des jouets'],
    1,
    2,
    0,
  ),
  quiz(
    38,
    'Vive le vent',
    'Quel est le titre original ?',
    ['Winter Wonderland', 'Silent Night', 'Jingle Bells'],
    2,
    3,
    0,
  ),
  quiz(
    39,
    'Douce nuit',
    'En quelle année fut-elle composée ?',
    ['1808', '1818', '1828'],
    1,
    2,
    0,
  ),
  quiz(
    40,
    'Mon beau sapin',
    'De quel pays vient la chanson ?',
    ['Allemagne', 'Suède', 'Italie'],
    0,
    2,
    0,
  ),
  quiz(
    41,
    'Minuit, chrétiens',
    'Qui en est le compositeur ?',
    ['Schubert', 'Beethoven', 'Adolphe Adam'],
    2,
    3,
    0,
  ),
  quiz(
    42,
    'Petit renne',
    'En quelle année fut-elle publiée ?',
    ['1939', '1949', '1955'],
    1,
    1,
    0,
  ),
  quiz(
    43,
    'Noël blanc',
    'Qui popularisa White Christmas ?',
    ['Frank Sinatra', 'Bing Crosby', 'Dean Martin'],
    1,
    2,
    0,
  ),
  quiz(
    44,
    'Les anges',
    'Dans quelle langue était l’original ?',
    ['Français', 'Italien', 'Espagnol'],
    0,
    1,
    0,
  ),
  quiz(
    45,
    'Divin enfant',
    'De quel siècle date le chant ?',
    ['19e', '18e', '17e'],
    1,
    2,
    0,
  ),
  quiz(
    46,
    'Gloria',
    'Que signifie Gloria in excelsis Deo ?',
    ['Gloire au monde', 'Chantons', 'Gloire à Dieu'],
    2,
    3,
    0,
  ),
  quiz(
    47,
    'Tambourin',
    'Quel instrument accompagne les bergers ?',
    ['Claves', 'Triangle', 'Tambourin'],
    2,
    2,
    0,
  ),
  quiz(
    48,
    'All I Want',
    'Qui interprète ce tube ?',
    ['Mariah Carey', 'Whitney Houston', 'Céline Dion'],
    0,
    1,
    0,
  ),
  quiz(
    49,
    'Renne guide',
    'Quel est son nom ?',
    ['Rudolph', 'Dasher', 'Comet'],
    0,
    1,
    -2,
  ),
  quiz(
    50,
    'Partage',
    'Quelle action est généreuse ?',
    ['Garder', 'Offrir', 'Cacher'],
    1,
    1,
    -1,
  ),
  quiz(
    51,
    'Sapin',
    'Quelle couleur n’est pas citée ?',
    ['Rouge', 'Argent', 'Bleu'],
    1,
    1,
    -1,
  ),
  quiz(
    52,
    'Rennes',
    'Lequel n’est pas un renne ?',
    ['Fringant', 'Comète', 'Frosty'],
    2,
    2,
    -2,
  ),
  quiz(
    53,
    'Couleurs',
    'Quel objet n’est pas rouge ?',
    ['Flocon', 'Houx', 'Boule'],
    0,
    1,
    -1,
  ),
  quiz(
    54,
    'Dessert',
    'Quel dessert français ?',
    ['Bûche', 'Tarte Tatin', 'Crêpe'],
    0,
    1,
    -2,
  ),
  quiz(
    55,
    'Pied du sapin',
    'Quel objet ne s’y trouve pas ?',
    ['Cadeau', 'Bougie allumée', 'Carte'],
    1,
    2,
    -3,
  ),
  quiz(
    56,
    'Cloche',
    'Quel est son rôle ?',
    ['Appeler les enfants', 'Décorer', 'Mesurer'],
    0,
    1,
    -1,
  ),
  quiz(
    57,
    'Magie',
    'Quel élément crée la magie ?',
    ['Guirlandes', 'Chocolat', 'Bottes'],
    0,
    1,
    -1,
  ),
  quiz(
    58,
    'Bonne action',
    'Quelle action est généreuse ?',
    ['Partager', 'Aider', 'Sourire'],
    0,
    3,
    0,
    true,
  ),
  quiz(
    59,
    'Cadeau au Père Noël',
    'Quel cadeau choisir ?',
    ['Un poème', 'Une chaussette', 'Du lait'],
    0,
    2,
    -2,
  ),
  quiz(
    60,
    'Moment préféré',
    'Quel moment attendent les enfants ?',
    ['Cadeaux', 'Dîner', 'Dormir'],
    0,
    1,
    -1,
  ),
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
  if (effect.kind === 'move') {
    return [gameEffects.custom('minuit.move', { delta: effect.delta })];
  }
  if (effect.kind === 'roll') return [gameEffects.custom('minuit.roll')];
  if (effect.kind === 'shield-malus') {
    return [
      gameEffects.addStatus({
        status: 'minuit.ignore-next-malus',
        scope: 'until-used',
      }),
    ];
  }
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
  if (effect.kind === 'shield-skip') {
    return [
      gameEffects.addStatus({
        status: 'minuit.ignore-next-skip',
        scope: 'until-used',
      }),
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
  if (effect.kind === 'force-draw') {
    return [
      gameEffects.addStatus({
        status: 'minuit.force-draw-next-turn',
        scope: 'until-used',
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
