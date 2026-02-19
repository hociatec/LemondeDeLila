import { toPlayerId } from './player-id.helper';

type PendingPawnOption = {
  id: string;
  label: string;
};

type NormalizeFn = (value: string) => string;

function defaultNormalize(value: string): string {
  return String(value ?? '').trim();
}

function normalizeOption(option: any): PendingPawnOption | null {
  const id = String(option?.id ?? '').trim();
  if (!id) return null;
  const label = String(option?.label ?? option?.name ?? id).trim();
  return { id, label };
}

export function isPendingPawnForPlayer(
  pending: any,
  playerId: number | null,
  pendingType: string = 'choose_pawn',
): boolean {
  if (!pending || String(pending.type ?? '').trim() !== pendingType) return false;
  if (playerId == null) return false;
  const pendingPlayerId = toPlayerId(pending.playerId);
  return pendingPlayerId != null && pendingPlayerId === playerId;
}

export function getPendingPawnOptions(pending: any): PendingPawnOption[] {
  const fromData = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
  return fromData.map(normalizeOption).filter(Boolean) as PendingPawnOption[];
}

export function listPendingPawnActions(
  pending: any,
  actionType: string,
): Array<{ type: string; payload: { pawnId: string } }> {
  return getPendingPawnOptions(pending)
    .map((option) => option.id)
    .filter((id) => id.length > 0)
    .map((pawnId) => ({ type: actionType, payload: { pawnId } }));
}

export function resolvePendingPawnId(
  pending: any,
  payload: any,
  normalize: NormalizeFn = defaultNormalize,
): string | null {
  const raw = String(payload?.pawnId ?? payload?.pawn ?? payload?.value ?? '').trim();
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
