import {
  freezeGameContent,
  gameEffects,
} from '../../../core/application/public-api';
import type {
  EffectTarget,
  GameEffectInstruction,
} from '../../../core/application/public-api';

export type BalloonPawn = {
  id: string;
  label: string;
  description: string;
};

export const A_FOND_LES_BALLONS_PAWNS: BalloonPawn[] = [
  {
    id: 'capitaine-cacahuete',
    label: 'Capitaine Cacahuète',
    description:
      'Écureuil roux moustachu, chapeau de pirate trop grand, cache-œil en noisette, épée en cure-dents. Aventurier grognon, rêve du « trésor de la noix éternelle ». Accessoire : carte au trésor qui sent la confiture. Pouvoir : « À l’abordage ! ».',
  },
  {
    id: 'professeur-gribouille',
    label: 'Professeur Gribouille',
    description:
      'Rat gris à lunettes carrées, fioles « pouf », « gloup » ou « BOUM », blouse trop longue, chapeau en entonnoir. Généreux mais distrait. Accessoire : bocal de bulles parfumées. Pouvoir : échange de place sur éternuement.',
  },
  {
    id: 'miss-froufrou',
    label: 'Miss Froufrou',
    description:
      'Cochon d’Inde blanc et rose, robe à volants, lunettes cœur, mini miroir pomme, parfum fraise. Coquette et gentille. Accessoire : sèche-cheveux enchanté qui joue de la harpe. Pouvoir : « pause beauté ». ',
  },
  {
    id: 'sir-croquou',
    label: 'Sir Croquou',
    description:
      'Castor brun au monocle doré, nœud papillon géant, théière accrochée à la queue. Très poli. Accessoire : valise de biscuits au citron. Pouvoir : « prendre le thé ».',
  },
  {
    id: 'chinchillator-3000',
    label: 'Chinchillator 3000',
    description:
      'Chinchilla argenté mi-robot, mi-roue de hamster. Un peu buggé mais très rapide. Accessoire : antenne extensible et oreille-micro. Pouvoir : « BIP-BLOUP-ZING ».',
  },
  {
    id: 'hamstero-dynamite',
    label: 'Hamstéro Dynamite',
    description:
      'Hamster beige et blanc, bandana rouge, lunettes de moto, mini cape. Hyperactif. Accessoire : pétards inoffensifs et serpentins. Pouvoir : « super tourbillon ».',
  },
];

const normalizeText = (value: string): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

export const resolvePawnId = (raw: unknown): string | null => {
  if (raw == null) return null;
  if (isRecord(raw)) {
    const maybeId = raw.id ?? raw.pawnId ?? raw.value;
    if (
      typeof maybeId === 'string' ||
      typeof maybeId === 'number' ||
      typeof maybeId === 'boolean'
    ) {
      raw = maybeId;
    }
  }
  const text = toText(raw);
  if (!text) return null;
  const key = normalizeText(text);
  if (!key) return null;
  const direct = A_FOND_LES_BALLONS_PAWNS.find(
    (p) => normalizeText(p.id) === key,
  );
  if (direct) return direct.id;
  const byLabel = A_FOND_LES_BALLONS_PAWNS.find(
    (p) => normalizeText(p.label) === key,
  );
  return byLabel ? byLabel.id : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
};

export type BalloonTileType =
  | 'start'
  | 'neutral'
  | 'bonus'
  | 'folie'
  | 'piege'
  | 'glissade'
  | 'tornade'
  | 'chaton'
  | 'finish';

export type BalloonTile = {
  type: BalloonTileType;
  label: string;
};

const TILE_TYPES: BalloonTileType[] = [
  'start',
  'bonus',
  'folie',
  'neutral',
  'piege',
  'glissade',
  'neutral',
  'tornade',
  'folie',
  'neutral',
  'bonus',
  'piege',
  'glissade',
  'neutral',
  'folie',
  'bonus',
  'piege',
  'glissade',
  'neutral',
  'folie',
  'chaton',
  'bonus',
  'piege',
  'glissade',
  'neutral',
  'folie',
  'bonus',
  'piege',
  'glissade',
  'neutral',
  'tornade',
  'folie',
  'bonus',
  'piege',
  'glissade',
  'neutral',
  'folie',
  'piege',
  'glissade',
  'finish',
];

const TILE_LABELS: Record<BalloonTileType, string> = {
  start: 'La Tanière à Tartines',
  neutral: 'Sentier tranquille',
  bonus: 'Tunnel bonus',
  folie: 'Folie loufoque',
  piege: 'Piège gluant',
  glissade: 'Glissade',
  tornade: 'Tornade',
  chaton: 'Grand Chaton Gourmand',
  finish: 'La Grosse Noix Dorée',
};

export const A_FOND_LES_BALLONS_TILES: BalloonTile[] = TILE_TYPES.map(
  (type, index) => ({
    type,
    label: `Case ${index + 1} — ${TILE_LABELS[type]}`,
  }),
);

export type BalloonCardEffect =
  | { type: 'move'; value: number }
  | { type: 'skip'; turns: number }
  | { type: 'move-all'; value: number }
  | { type: 'next'; tile: 'bonus' | 'folie' }
  | { type: 'freeze-all' }
  | { type: 'extra-turn' }
  | { type: 'repeat-roll-all' }
  | { type: 'swap' }
  | { type: 'go-to'; position: number }
  | { type: 'boutique' }
  | { type: 'trap-immunity'; turns: number }
  | { type: 'random-all' }
  | { type: 'finish-if-slide' };

export type BalloonCard = {
  id: number;
  text: string;
  effects: readonly GameEffectInstruction[];
  retreatScore: number;
};

type BalloonCardDefinition = Omit<BalloonCard, 'effects' | 'retreatScore'> & {
  effect: BalloonCardEffect;
};

const CARD_DEFINITIONS: BalloonCardDefinition[] = [
  {
    id: 1,
    text: 'Peau de banane : reculez de 2 cases.',
    effect: { type: 'move', value: -2 },
  },
  {
    id: 2,
    text: 'Cookie géant : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 3,
    text: 'Confiture : avancez d’une case.',
    effect: { type: 'move', value: 1 },
  },
  {
    id: 4,
    text: 'Noix étrange : tous passent un tour.',
    effect: { type: 'freeze-all' },
  },
  {
    id: 5,
    text: 'Écureuil volant : avancez de 4 cases.',
    effect: { type: 'move', value: 4 },
  },
  {
    id: 6,
    text: 'Sirop magique : tous reculent d’une case.',
    effect: { type: 'move-all', value: -1 },
  },
  {
    id: 7,
    text: 'Réglisse : avancez de 2 cases.',
    effect: { type: 'move', value: 2 },
  },
  {
    id: 8,
    text: 'Éternuement du Chaton : reculez d’une case.',
    effect: { type: 'move', value: -1 },
  },
  {
    id: 9,
    text: 'Chewing-gum : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 10,
    text: 'Noisette turbo : prochaine case Bonus.',
    effect: { type: 'next', tile: 'bonus' },
  },
  {
    id: 11,
    text: 'Mal au ventre : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 12,
    text: 'Museau qui démange : reculez d’une case.',
    effect: { type: 'move', value: -1 },
  },
  {
    id: 13,
    text: 'Gerboise : avancez de 2 cases.',
    effect: { type: 'move', value: 2 },
  },
  {
    id: 14,
    text: 'Trottinette : avancez de 3 cases.',
    effect: { type: 'move', value: 3 },
  },
  {
    id: 15,
    text: 'Cacahuètes : reculez d’une case.',
    effect: { type: 'move', value: -1 },
  },
  {
    id: 16,
    text: 'Bulle géante : prochaine case Folie.',
    effect: { type: 'next', tile: 'folie' },
  },
  {
    id: 17,
    text: 'Sieste : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 18,
    text: 'Souris malicieuse : avancez de 2 cases.',
    effect: { type: 'move', value: 2 },
  },
  {
    id: 19,
    text: 'Loir guide : avancez d’une case.',
    effect: { type: 'move', value: 1 },
  },
  {
    id: 20,
    text: 'Chaussette-bonnet : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 21,
    text: 'Peinture fluo : tous avancent d’une case.',
    effect: { type: 'move-all', value: 1 },
  },
  {
    id: 22,
    text: 'Fromage magique : passez deux tours.',
    effect: { type: 'skip', turns: 2 },
  },
  {
    id: 23,
    text: 'Trampoline : avancez de 4 cases.',
    effect: { type: 'move', value: 4 },
  },
  {
    id: 24,
    text: 'Agouti philosophe : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 25,
    text: 'Cabane en biscuits : rejouez.',
    effect: { type: 'extra-turn' },
  },
  {
    id: 26,
    text: 'Confettis : tous avancent du dernier lancer.',
    effect: { type: 'repeat-roll-all' },
  },
  {
    id: 27,
    text: 'Avion en carton : reculez d’une case.',
    effect: { type: 'move', value: -1 },
  },
  {
    id: 28,
    text: 'Grimoire : échangez votre position.',
    effect: { type: 'swap' },
  },
  {
    id: 29,
    text: 'Catapulte : allez en case 13.',
    effect: { type: 'go-to', position: 12 },
  },
  {
    id: 30,
    text: 'Mousse épaisse : passez un tour.',
    effect: { type: 'skip', turns: 1 },
  },
  {
    id: 31,
    text: 'Hutia : avancez d’une case.',
    effect: { type: 'move', value: 1 },
  },
  {
    id: 32,
    text: 'Fromage bavard : avancez de 2 cases.',
    effect: { type: 'move', value: 2 },
  },
  {
    id: 33,
    text: 'Saute-rongeur : avancez de 3 cases.',
    effect: { type: 'move', value: 3 },
  },
  {
    id: 34,
    text: 'Boutique : appliquez la plus reculante de deux cartes.',
    effect: { type: 'boutique' },
  },
  {
    id: 35,
    text: 'Tunnel défectueux : retour au départ.',
    effect: { type: 'go-to', position: 0 },
  },
  {
    id: 36,
    text: 'Invisibilité : ignorez les pièges deux tours.',
    effect: { type: 'trap-immunity', turns: 2 },
  },
  {
    id: 37,
    text: 'Piment : reculez de 5 cases.',
    effect: { type: 'move', value: -5 },
  },
  {
    id: 38,
    text: 'Biscuit explosif : tous bougent au hasard.',
    effect: { type: 'random-all' },
  },
  {
    id: 39,
    text: 'Pluie de bonbons : avancez de 2 cases.',
    effect: { type: 'move', value: 2 },
  },
  {
    id: 40,
    text: 'Reine des Rongeurs : terminez depuis une Glissade.',
    effect: { type: 'finish-if-slide' },
  },
];

export const A_FOND_LES_BALLONS_CARDS: BalloonCard[] = CARD_DEFINITIONS.map(
  (card) => ({
    id: card.id,
    text: card.text,
    effects: cardInstructions(card.effect),
    retreatScore: effectRetreatScore(card.effect),
  }),
);

function cardInstructions(
  effect: BalloonCardEffect,
): readonly GameEffectInstruction[] {
  if (effect.type === 'move') {
    return [
      gameEffects.custom(
        'a-fond-les-ballons.move',
        { delta: effect.value },
        gameEffects.target.self(),
      ),
    ];
  }
  if (effect.type === 'skip') return [gameEffects.skipTurn(effect.turns)];
  if (effect.type === 'move-all') {
    return allPlayers((target) =>
      gameEffects.custom(
        'a-fond-les-ballons.move',
        { delta: effect.value },
        target,
      ),
    );
  }
  if (effect.type === 'next') {
    return [
      gameEffects.custom('a-fond-les-ballons.next-tile', {
        tile: effect.tile,
      }),
    ];
  }
  if (effect.type === 'freeze-all') {
    return [
      gameEffects.skipTurn(1),
      gameEffects.skipTurn(1, gameEffects.target.allOpponents()),
    ];
  }
  if (effect.type === 'extra-turn') return [gameEffects.extraTurn()];
  if (effect.type === 'repeat-roll-all') {
    return allPlayers((target) =>
      gameEffects.custom('a-fond-les-ballons.repeat-roll', {}, target),
    );
  }
  if (effect.type === 'swap') {
    return [
      gameEffects.custom(
        'a-fond-les-ballons.swap',
        {},
        gameEffects.target.chosenOpponent('a-fond-les-ballons.swap', true),
      ),
      gameEffects.completeTurn(),
    ];
  }
  if (effect.type === 'go-to') {
    return [
      gameEffects.custom('a-fond-les-ballons.go-to', {
        position: effect.position,
      }),
    ];
  }
  if (effect.type === 'boutique') {
    return [gameEffects.custom('a-fond-les-ballons.boutique')];
  }
  if (effect.type === 'trap-immunity') {
    return [
      gameEffects.addStatus({
        status: 'a-fond-les-ballons.trap-immunity',
        turns: effect.turns,
        scope: 'turn',
        stack: true,
      }),
    ];
  }
  if (effect.type === 'random-all') {
    return allPlayers((target) =>
      gameEffects.custom('a-fond-les-ballons.random-move', {}, target),
    );
  }
  return [gameEffects.custom('a-fond-les-ballons.finish-if-slide')];
}

function allPlayers(
  instruction: (target: EffectTarget) => GameEffectInstruction,
): readonly GameEffectInstruction[] {
  return [
    instruction(gameEffects.target.self()),
    instruction(gameEffects.target.allOpponents()),
  ];
}

function effectRetreatScore(effect: BalloonCardEffect): number {
  if (effect.type === 'go-to' && effect.position === 0) return -200;
  if (effect.type === 'go-to') return -100;
  if (effect.type === 'move' && effect.value < 0) return effect.value;
  if (effect.type === 'move-all' && effect.value < 0) return effect.value;
  return 0;
}

freezeGameContent(A_FOND_LES_BALLONS_PAWNS);
freezeGameContent(A_FOND_LES_BALLONS_TILES);
freezeGameContent(A_FOND_LES_BALLONS_CARDS);
