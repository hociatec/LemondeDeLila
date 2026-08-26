export type GaloponsRegion = 'prairie' | 'riviere' | 'foret' | 'montagne';
export type GaloponsTileType =
  | 'start'
  | 'neutral'
  | 'card'
  | 'bonus'
  | 'skip'
  | 'finish';

export type GaloponsTile = {
  n: number;
  title: string;
  type: GaloponsTileType;
  region: GaloponsRegion;
  apples: number;
  skipTurns: number;
};

const CARD_SPACES = new Set([2, 6, 8, 11, 17, 21, 26, 31, 33, 36]);
const BONUS_SPACES = new Set([4, 15, 24, 34]);
const SKIP_SPACES = new Set([13, 23]);

export const GALOPONS_TILES: GaloponsTile[] = Array.from(
  { length: 40 },
  (_entry, index) => {
    const type: GaloponsTileType =
      index === 0
        ? 'start'
        : index === 39
          ? 'finish'
          : CARD_SPACES.has(index)
            ? 'card'
            : BONUS_SPACES.has(index)
              ? 'bonus'
              : SKIP_SPACES.has(index)
                ? 'skip'
                : 'neutral';
    const region: GaloponsRegion =
      index < 10
        ? 'prairie'
        : index < 20
          ? 'riviere'
          : index < 30
            ? 'foret'
            : 'montagne';
    return {
      n: index + 1,
      title:
        type === 'start'
          ? 'Départ'
          : type === 'finish'
            ? 'Écurie finale'
            : type === 'card'
              ? 'Fer à cheval'
              : type === 'bonus'
                ? 'Pomme bonus'
                : type === 'skip'
                  ? 'Obstacle'
                  : 'Sentier',
      type,
      region,
      apples: type === 'bonus' ? 1 : 0,
      skipTurns: type === 'skip' ? 1 : 0,
    };
  },
);

export type GaloponsCardEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'move_to_next_region'; region: 'foret' | 'montagne' }
  | { kind: 'replay' }
  | { kind: 'gain_apples'; count: number }
  | { kind: 'skip_turn'; count: number }
  | { kind: 'give_apple_with_iou' }
  | { kind: 'discard_apple_and_replay' }
  | { kind: 'help_advance_for_apple'; delta: number }
  | { kind: 'pair_advance'; delta: number }
  | { kind: 'global_skip_turn'; count: number }
  | { kind: 'discard_apple' };

export type GaloponsCard = {
  id: number;
  text: string;
  effect: GaloponsCardEffect;
};

export const GALOPONS_CARDS: GaloponsCard[] = [
  {
    id: 1,
    text: 'Raccourci : avancez de 2 cases.',
    effect: { kind: 'move', delta: 2 },
  },
  { id: 2, text: 'Belle cabriole : rejouez.', effect: { kind: 'replay' } },
  {
    id: 3,
    text: 'Fruit trouvé : gagnez une pomme.',
    effect: { kind: 'gain_apples', count: 1 },
  },
  {
    id: 4,
    text: 'Pause à la rivière : passez un tour.',
    effect: { kind: 'skip_turn', count: 1 },
  },
  {
    id: 5,
    text: 'Donnez une pomme avec reconnaissance de dette.',
    effect: { kind: 'give_apple_with_iou' },
  },
  {
    id: 6,
    text: 'Fer perdu : reculez de 2 cases.',
    effect: { kind: 'move', delta: -2 },
  },
  {
    id: 7,
    text: 'Chant d’oiseau : avancez d’une case.',
    effect: { kind: 'move', delta: 1 },
  },
  {
    id: 8,
    text: 'Pause broutage : passez un tour.',
    effect: { kind: 'skip_turn', count: 1 },
  },
  {
    id: 9,
    text: 'Chemin secret vers la forêt.',
    effect: { kind: 'move_to_next_region', region: 'foret' },
  },
  {
    id: 10,
    text: 'Boue : reculez d’une case.',
    effect: { kind: 'move', delta: -1 },
  },
  { id: 11, text: 'Papillon : rejouez.', effect: { kind: 'replay' } },
  {
    id: 12,
    text: 'Jument amie : avancez de 3 cases.',
    effect: { kind: 'move', delta: 3 },
  },
  {
    id: 13,
    text: 'Saut élégant : gagnez une pomme.',
    effect: { kind: 'gain_apples', count: 1 },
  },
  {
    id: 14,
    text: 'Bruit soudain : reculez d’une case.',
    effect: { kind: 'move', delta: -1 },
  },
  {
    id: 15,
    text: 'Aidez un poulain : défaussez une pomme et rejouez.',
    effect: { kind: 'discard_apple_and_replay' },
  },
  {
    id: 16,
    text: 'Cachette de fruits : gagnez deux pommes.',
    effect: { kind: 'gain_apples', count: 2 },
  },
  {
    id: 17,
    text: 'Pluie : passez un tour.',
    effect: { kind: 'skip_turn', count: 1 },
  },
  {
    id: 18,
    text: 'Grand galop : avancez de 4 cases.',
    effect: { kind: 'move', delta: 4 },
  },
  {
    id: 19,
    text: 'Chapeau perdu : reculez d’une case.',
    effect: { kind: 'move', delta: -1 },
  },
  {
    id: 20,
    text: 'Aidez un joueur à avancer contre une pomme.',
    effect: { kind: 'help_advance_for_apple', delta: 2 },
  },
  {
    id: 21,
    text: 'Hennissement de joie : rejouez.',
    effect: { kind: 'replay' },
  },
  {
    id: 22,
    text: 'Branche : passez un tour.',
    effect: { kind: 'skip_turn', count: 1 },
  },
  {
    id: 23,
    text: 'Chemin vers la montagne.',
    effect: { kind: 'move_to_next_region', region: 'montagne' },
  },
  {
    id: 24,
    text: 'Fatigue : défaussez une pomme.',
    effect: { kind: 'discard_apple' },
  },
  {
    id: 25,
    text: 'Beau sabot : gagnez deux pommes.',
    effect: { kind: 'gain_apples', count: 2 },
  },
  {
    id: 26,
    text: 'Flaque : reculez d’une case.',
    effect: { kind: 'move', delta: -1 },
  },
  {
    id: 27,
    text: 'Ruisseau franchi : avancez de 2 cases.',
    effect: { kind: 'move', delta: 2 },
  },
  {
    id: 28,
    text: 'Trèfle : avancez à deux.',
    effect: { kind: 'pair_advance', delta: 1 },
  },
  {
    id: 29,
    text: 'Pause câlin : tous passent un tour.',
    effect: { kind: 'global_skip_turn', count: 1 },
  },
  {
    id: 30,
    text: 'Nuage de mouches : reculez de 2 cases.',
    effect: { kind: 'move', delta: -2 },
  },
];

export const GALOPONS_PAWNS = [
  {
    id: 'shetland',
    name: 'Le Poney Shetland',
    description: 'Petit, robuste et malicieux.',
  },
  {
    id: 'mustang',
    name: 'Le Mustang',
    description: 'Rapide, libre et un peu rebelle.',
  },
  { id: 'percheron', name: 'Le Percheron', description: 'Puissant et calme.' },
  {
    id: 'camargue',
    name: 'Le Camargue',
    description: 'Rustique et courageux.',
  },
] as const;
