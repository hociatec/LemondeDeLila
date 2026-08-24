import type { GameSingleActionDto } from '../models/game-action.model';
import type { GameStateEntity } from '../models/game-state.model';

export type PawnChoiceOption = {
  id: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
};

type PendingChoice = {
  type?: unknown;
  playerId?: unknown;
  data?: {
    pawns?: unknown;
  };
};

export type PendingPawnChoiceAction = {
  playerId: number;
  options: PawnChoiceOption[];
  chosen: PawnChoiceOption;
  pending: PendingChoice;
};

export function resolvePendingPawnChoiceAction(params: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  pendingType?: string;
  resolveChoice: (
    rawValue: unknown,
    options: PawnChoiceOption[],
  ) => PawnChoiceOption | null;
}): PendingPawnChoiceAction | null {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
  const pending = (params.state?.pending ?? null) as PendingChoice | null;
  if (!pending || pending.type !== pendingType) return null;

  const playerIdRaw =
    typeof pending.playerId === 'number'
      ? pending.playerId
      : (params.state?.turn?.currentPlayerId ?? null);
  if (typeof playerIdRaw !== 'number' || !Number.isFinite(playerIdRaw)) {
    return null;
  }

  const payload =
    params.action?.payload && typeof params.action.payload === 'object'
      ? params.action.payload
      : {};
  const rawChoice =
    payload.pawnId ??
    payload.id ??
    payload.pawn ??
    payload.value ??
    payload.optionId ??
    payload.selectedChoice ??
    payload.choice ??
    payload.label ??
    null;
  const optionsRaw = Array.isArray(pending?.data?.pawns)
    ? pending.data.pawns
    : [];
  const options = optionsRaw
    .map((entry) => normalizePawnChoiceOption(entry))
    .filter((entry): entry is PawnChoiceOption => entry !== null);
  const chosen = params.resolveChoice(rawChoice, options);
  if (!chosen) return null;

  return {
    playerId: playerIdRaw,
    options,
    chosen,
    pending,
  };
}

function normalizePawnChoiceOption(value: unknown): PawnChoiceOption | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = toText(record.id);
  if (!id) return null;
  const label = toText(record.label) || id;
  const out: PawnChoiceOption = { ...record, id, label };
  if (Object.prototype.hasOwnProperty.call(record, 'description')) {
    out.description = toText(record.description);
  }
  return out;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}


