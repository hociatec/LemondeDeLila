import { A_FOND_LES_BALLONS_PAWNS } from './pawns';
export { A_FOND_LES_BALLONS_PAWNS, type BalloonPawn } from './pawns';

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
