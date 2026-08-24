import type {
  AFondLesBallonsCard,
  AFondLesBallonsMetadata,
  AFondLesBallonsPendingSwap,
  AFondLesBallonsTile,
} from '../../model/a-fond-les-ballons-state.model';

export type AFondRuntimeMetadata = AFondLesBallonsMetadata & {
  aFondKeepTurn?: boolean;
};

export function asAFondRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toAFondText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function normalizeAFondMeta(input: unknown): AFondRuntimeMetadata {
  const raw = asAFondRecord(input);
  return {
    rng: asAFondRecord(raw.rng),
    tiles: (Array.isArray(raw.tiles) ? raw.tiles : []) as AFondLesBallonsTile[],
    positions: asAFondRecord(raw.positions) as Record<number, number>,
    pawns: (Array.isArray(raw.pawns)
      ? raw.pawns
      : []) as AFondLesBallonsMetadata['pawns'],
    pawnByPlayerId:
      (asAFondRecord(raw.pawnByPlayerId) as Record<number, string>) ?? {},
    setupStarterId:
      typeof raw.setupStarterId === 'number' ? raw.setupStarterId : null,
    charactersByPlayerId:
      (asAFondRecord(
        raw.charactersByPlayerId,
      ) as AFondLesBallonsMetadata['charactersByPlayerId']) ?? {},
    statuses: {
      skipTurn:
        (asAFondRecord(asAFondRecord(raw.statuses).skipTurn) as Record<
          number,
          number
        >) ?? {},
      trapImmunityTurns:
        (asAFondRecord(asAFondRecord(raw.statuses).trapImmunityTurns) as Record<
          number,
          number
        >) ?? {},
    },
    decks: {
      loufoque: (Array.isArray(asAFondRecord(raw.decks).loufoque)
        ? asAFondRecord(raw.decks).loufoque
        : []) as AFondLesBallonsCard[],
      discardLoufoque: (Array.isArray(asAFondRecord(raw.decks).discardLoufoque)
        ? asAFondRecord(raw.decks).discardLoufoque
        : []) as AFondLesBallonsCard[],
    },
    winnerId: typeof raw.winnerId === 'number' ? raw.winnerId : null,
    aFondKeepTurn: raw.aFondKeepTurn === true,
  };
}

export function asAFondPendingRecord(value: unknown): {
  type?: string;
  playerId?: unknown;
  data?: Record<string, unknown>;
} | null {
  if (!value || typeof value !== 'object') return null;
  const record = asAFondRecord(value);
  return {
    type: toAFondText(record.type),
    playerId: record.playerId,
    data: asAFondRecord(record.data),
  };
}

export function asAFondPendingSwap(
  value: unknown,
): AFondLesBallonsPendingSwap | null {
  if (!value || typeof value !== 'object') return null;
  const record = asAFondRecord(value);
  if (toAFondText(record.type) !== 'swap') return null;
  const playerId = Number(record.playerId);
  if (!Number.isFinite(playerId)) return null;
  const data = asAFondRecord(record.data);
  const targets = Array.isArray(data.targets)
    ? data.targets
        .map((entry) => {
          const out = asAFondRecord(entry);
          const targetPlayerId = Number(out.targetPlayerId);
          const targetUsername = toAFondText(out.targetUsername);
          if (!Number.isFinite(targetPlayerId) || !targetUsername) return null;
          return { targetPlayerId, targetUsername };
        })
        .filter(
          (
            entry,
          ): entry is { targetPlayerId: number; targetUsername: string } =>
            entry !== null,
        )
    : [];
  return {
    type: 'swap',
    label: toAFondText(record.label),
    playerId,
    blocking: true,
    choices: (Array.isArray(record.choices) ? record.choices : [])
      .map((entry) => toAFondText(entry))
      .filter((entry) => entry.length > 0),
    data: { targets },
  };
}

export function asAFondLoufoqueCard(
  value: unknown,
): AFondLesBallonsCard | null {
  if (!value || typeof value !== 'object') return null;
  const record = asAFondRecord(value);
  const id = Number(record.id);
  const text = toAFondText(record.text);
  if (!Number.isFinite(id) || !text) return null;
  return { id, text };
}

export function computeAFondTarget(
  current: number,
  delta: number,
  finalIndex: number,
): number {
  let value = current + delta;
  if (value < 0) return 0;
  while (value > finalIndex) {
    const overshoot = value - finalIndex;
    value = finalIndex - overshoot;
    if (value < 0) return 0;
  }
  return value;
}

export function describeAFondPawnLabel(
  meta: AFondRuntimeMetadata,
  id: number,
): string {
  const pawnId = toAFondText(meta.pawnByPlayerId?.[id]);
  const pawn = Array.isArray(meta.pawns)
    ? meta.pawns.find((entry) => toAFondText(entry?.id) === pawnId)
    : null;
  const title = toAFondText(pawn?.label);
  if (title) return `"${title}"`;
  return 'un pion';
}

export function compactAFondTileLabel(
  rawLabel: string | undefined,
  position: number,
): string {
  const fallback = `Case ${position + 1}`;
  const value = String(rawLabel ?? fallback).trim();
  if (!value) {
    return fallback;
  }
  return value.replace(/^Case\s+\d+\s*-\s*/i, '').trim() || fallback;
}

export function pickMostReculer(
  a: AFondLesBallonsCard | null,
  b: AFondLesBallonsCard | null,
): AFondLesBallonsCard | null {
  const score = (card: AFondLesBallonsCard | null): number => {
    if (!card) return Number.POSITIVE_INFINITY;
    if (card.id === 37) return -5;
    if (card.id === 29) return -100;
    if (card.id === 35) return -200;
    if (card.id === 1) return -2;
    if (card.id === 6 || card.id === 8 || card.id === 12 || card.id === 15) {
      return -1;
    }
    if (card.id === 27) return -1;
    return 0;
  };
  const left = score(a);
  const right = score(b);
  if (
    left === Number.POSITIVE_INFINITY &&
    right === Number.POSITIVE_INFINITY
  ) {
    return null;
  }
  return left <= right ? a : b;
}

export function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    {
      id: 1,
      text: 'Vous glissez sur une peau de banane séchée. Reculez de 2 cases.',
    },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie géant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: "Vous sautez dans une flaque de confiture collante. Avancez d'une case.",
    },
    {
      id: 4,
      text: "Une noix étrange chante et perturbe la tanière. La partie est figée : aucun joueur n'agit pendant ce tour.",
    },
    {
      id: 5,
      text: 'Un écureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: "Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d'une case.",
    },
    {
      id: 7,
      text: 'Vous trouvez une corde à sauter en réglisse enchantée. Avancez de 2 cases.',
    },
    { id: 8, text: "Le Grand Chaton éternue violemment. Reculez d'une case." },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: "Un lérot ninja surgit et vous tend une noisette turbo. Avancez jusqu'à la prochaine case Bonus.",
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: "Votre museau vous démange sans raison. Reculez d'une case.",
    },
    {
      id: 13,
      text: "Une gerboise farceuse vous chatouille les pattes. Sautez d'une case.",
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: "Vous faites tomber une montagne de cacahuètes. Distrait, vous reculez d'une case.",
    },
    {
      id: 16,
      text: "Une bulle de savon géante vous emporte. Avancez jusqu'à la prochaine case Folie.",
    },
    {
      id: 17,
      text: 'Un capybara vous invite à une sieste improvisée. Passez votre tour et ronflez à ses côtés.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file à toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: "Un loir vous montre le chemin en remuant la queue. Avancez d'une case en souriant.",
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: "Vous renversez un pot de peinture fluo. Tout le monde avance d'une case.",
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline géant. Avancez de 4 cases.' },
    {
      id: 24,
      text: 'Un agouti philosophe vous parle longuement. Passez votre tour.',
    },
    {
      id: 25,
      text: 'Vous construisez une solide cabane en biscuits. Rejouez.',
    },
    {
      id: 26,
      text: 'Vous éternuez des confettis multicolores. Tous les joueurs avancent du même nombre de cases obtenu précédemment.',
    },
    {
      id: 27,
      text: "Un petit avion de carton vous emporte maladroitement. Avancez d'une case, puis reculez de deux.",
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Échangez votre position avec le joueur de votre choix.',
    },
    { id: 29, text: 'Une catapulte de fromage rebondit sur vous. Allez en case 13.' },
    {
      id: 30,
      text: "Vous tombez dans une mare d'épaisse mousse. Passez votre tour.",
    },
    {
      id: 31,
      text: "Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d'une case un peu étourdi.",
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrésistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez à saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel défectueux vous mène droit chez le Chaton gourmand. Retournez à la case départ.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases Piège.',
    },
    { id: 37, text: 'Vous mangez un piment super piquant. Reculez de 5 cases.' },
    {
      id: 38,
      text: "Un biscuit géant explose. Tous les joueurs se déplacent d'une case aléatoire.",
    },
    { id: 39, text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.' },
    {
      id: 40,
      text: "La Reine des Rongeurs vous envoie un message. Si vous êtes sur une case Glissade, avancez jusqu'à la case 40.",
    },
  ];
}
