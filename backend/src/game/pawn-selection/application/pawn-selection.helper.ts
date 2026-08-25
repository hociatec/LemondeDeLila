import { toPlayerId } from '../../core/application/helpers/player-id.helper';

type PendingPawnOption = {
  id: string;
  label: string;
};

export type PendingPawnPayload = {
  type?: unknown;
  playerId?: unknown;
  data?: Record<string, unknown>;
};

export type PendingPawnChoicePayload = {
  id?: unknown;
  pawnId?: unknown;
  pawn?: unknown;
  label?: unknown;
  selectedChoice?: unknown;
  choice?: unknown;
  optionId?: unknown;
  value?: unknown;
};

type NormalizeFn = (value: string) => string;

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function defaultNormalize(value: string): string {
  return value.trim();
}

function normalizeOption(
  option: Record<string, unknown>,
): PendingPawnOption | null {
  const id = toText(option.id).trim();
  if (!id) return null;
  const labelRaw = option.label ?? option.name ?? id;
  const label = toText(labelRaw).trim();
  return { id, label };
}

export function isPendingPawnForPlayer(
  pending: PendingPawnPayload | null | undefined,
  playerId: number | null,
  pendingType: string = 'choose_pawn',
): boolean {
  if (!pending || toText(pending.type).trim() !== pendingType) return false;
  if (playerId == null) return false;
  const pendingPlayerId = toPlayerId(pending.playerId);
  return pendingPlayerId != null && pendingPlayerId === playerId;
}

export function getPendingPawnOptions(
  pending: PendingPawnPayload | null | undefined,
): PendingPawnOption[] {
  const data = pending?.data as Record<string, unknown> | null | undefined;
  const fromDataRaw = Array.isArray(data?.pawns) ? data.pawns : [];
  const fromData = fromDataRaw.filter(
    (option): option is Record<string, unknown> =>
      Boolean(option) && typeof option === 'object',
  );
  return fromData
    .map(normalizeOption)
    .filter((x): x is PendingPawnOption => x != null);
}

export function listPendingPawnActions(
  pending: PendingPawnPayload | null | undefined,
  actionType: string,
): Array<{
  type: string;
  label: string;
  payload: { id: string; pawnId: string; pawn: string; value: string };
}> {
  return getPendingPawnOptions(pending)
    .filter((option) => option.id.length > 0)
    .map((option) => ({
      type: actionType,
      label: option.label || option.id,
      payload: {
        id: option.id,
        pawnId: option.id,
        pawn: option.id,
        value: option.id,
      },
    }));
}

export function resolvePendingPawnId(
  pending: PendingPawnPayload | null | undefined,
  payload: PendingPawnChoicePayload,
  normalize: NormalizeFn = defaultNormalize,
): string | null {
  const raw = toText(
    payload?.pawnId ??
      payload?.id ??
      payload?.pawn ??
      payload?.value ??
      payload?.optionId ??
      payload?.selectedChoice ??
      payload?.choice ??
      payload?.label,
  ).trim();
  if (!raw) return null;

  const options = getPendingPawnOptions(pending);
  const normalizedRequested = normalize(raw);
  if (!normalizedRequested) return null;

  for (const option of options) {
    const candidates = [option.id, option.label];
    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate);
      if (normalizedCandidate && normalizedCandidate === normalizedRequested) {
        return option.id;
      }
    }
  }

  return null;
}
