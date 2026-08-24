import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  ContesCard,
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesNarration,
} from '../../model/contes-et-cacahuetes-state.model';

export function toContesRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toContesText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function toContesCardArray(value: unknown): ContesCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = toContesRecord(entry);
      const id = Number(record.id);
      const type = toContesText(record.type);
      const title = toContesText(record.title);
      const text = toContesText(record.text);
      const isType =
        type === 'bonus' ||
        type === 'malus' ||
        type === 'surprise' ||
        type === 'conte';
      if (!Number.isFinite(id) || !isType || !title || !text) return null;
      return { id, type, title, text } as ContesCard;
    })
    .filter((entry): entry is ContesCard => entry !== null);
}

export function recordContesNarrationState(
  state: GameStateEntity,
  meta: ContesCacahuetesMetadata,
  playerId: number,
  card: ContesCard,
): GameStateEntity {
  const narration: ContesNarration = {
    playerId,
    title: card.title,
    text: card.text,
    timestamp: new Date().toISOString(),
  };
  return {
    ...state,
    metadata: {
      ...meta,
      lastConte: narration,
    },
  };
}

export function buildContesNarrationFromTile(
  tile: ContesCacahuetesTile | undefined,
): ContesCard | null {
  if (!tile) return null;
  const title = normalizeConteTileTitle(toContesText(tile.label));
  const text = toContesText(tile.description).trim();
  if (!title || !text) {
    return null;
  }

  return {
    id: 0,
    type: 'conte',
    title,
    text,
  };
}

export function normalizeConteTileTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return '';
  }

  const withoutPrefix = trimmed.replace(/^case\s+conte\s*-\s*/i, '').trim();
  if (!withoutPrefix) {
    return trimmed;
  }

  return `Conte - ${withoutPrefix}`;
}

export function describeContesPlayerPawn(
  state: GameStateEntity,
  meta: ContesCacahuetesMetadata,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => Number(entry?.id) === playerId);
  if (!player) return '';
  const pawnId = toContesText(player.pawn).trim();
  if (!pawnId) return '';
  const pawns = Array.isArray(meta.pawns) ? meta.pawns : [];
  const match = pawns.find((pawn) => toContesText(pawn?.id).trim() === pawnId);
  const fullLabel =
    match && toContesText(match.label).trim()
      ? toContesText(match.label).trim()
      : pawnId;
  return simplifyContesPawnLabel(fullLabel);
}

export function simplifyContesPawnLabel(label: string): string {
  const text = toContesText(label).trim();
  if (!text) return '';
  return text.split(' - ')[0]?.trim() ?? text;
}

export function formatContesArrivalTarget(label: string): string {
  const text = String(label ?? '').trim();
  if (!text) return 'sur sa case';
  if (/^case\b/i.test(text)) return `sur une ${text}`;
  return `sur ${text}`;
}
