import type {
  GameStateEntity,
  PendingState,
} from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import type { SacMetadata, SacTile } from '../model/sac-a-malices.types';

export type SacPropertyChoiceKind =
  | 'build'
  | 'sell_building'
  | 'mortgage'
  | 'unmortgage';

type PropertyChoiceOption = { tileIndex: number; label: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toNumberValue(value: unknown): number | null {
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(candidate) ? candidate : null;
}

export function openSacAMalicesPropertyChoice(input: {
  state: GameStateEntity;
  kind: SacPropertyChoiceKind;
  getCurrentPlayerId: (state: GameStateEntity) => number | null;
  getMeta: (state: GameStateEntity) => SacMetadata;
  buildOptions: (
    meta: SacMetadata,
    playerId: number,
    kind: SacPropertyChoiceKind,
  ) => PropertyChoiceOption[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const { state, kind } = input;
  if (String(state.status ?? '').toLowerCase() !== 'started') return state;
  if (state.pending) return state;

  const playerId = input.getCurrentPlayerId(state);
  if (playerId == null) return state;

  const options = input.buildOptions(input.getMeta(state), playerId, kind);
  if (!options.length) {
    return input.appendLog(
      state,
      'Aucune propriété disponible pour cette action.',
    );
  }

  const pending: PendingState = {
    type: 'choose_property',
    playerId,
    blocking: true,
    label:
      kind === 'build'
        ? 'Construire où ?'
        : kind === 'sell_building'
          ? 'Vendre une habitation où ?'
          : kind === 'mortgage'
            ? 'Hypothéquer quoi ?'
            : 'Lever l’hypothèque de quoi ?',
    choices: options.map((option) => option.label),
    data: {
      kind,
      options: options.map((option) => ({ tileIndex: option.tileIndex })),
    },
  };

  return { ...state, pending };
}

export function resolveSacAMalicesPropertyChoice(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getCurrentPlayerId: (state: GameStateEntity) => number | null;
  getMeta: (state: GameStateEntity) => SacMetadata;
  applyChoice: (args: {
    state: GameStateEntity;
    kind: SacPropertyChoiceKind;
    playerId: number;
    tileIndex: number;
    tile: SacTile;
  }) => GameStateEntity;
}): GameStateEntity {
  const { state, action } = input;
  if (String(state.status ?? '').toLowerCase() !== 'started') return state;

  const pending = state.pending;
  const pendingRow = asRecord(pending);
  if (!pending || pendingRow.type !== 'choose_property') return state;

  const playerId =
    typeof pendingRow.playerId === 'number'
      ? pendingRow.playerId
      : input.getCurrentPlayerId(state);
  if (playerId == null) return state;

  const payload = asRecord(action.payload);
  const wanted = toNumberValue(payload.tileIndex);
  const data = asRecord(pendingRow.data);
  const options: Array<{ tileIndex: number }> = Array.isArray(data.options)
    ? (data.options as Array<{ tileIndex: number }>)
    : [];
  if (wanted == null) return state;
  if (!options.some((option) => option.tileIndex === wanted)) return state;

  const kind = toStringValue(data.kind);
  if (
    kind !== 'build' &&
    kind !== 'sell_building' &&
    kind !== 'mortgage' &&
    kind !== 'unmortgage'
  ) {
    return { ...state, pending: null };
  }

  let next: GameStateEntity = { ...state, pending: null };
  const meta = input.getMeta(next);
  const tile = meta.tiles?.[wanted];
  if (!tile) return next;
  if (meta.ownership?.[wanted] !== playerId) return next;

  return input.applyChoice({
    state: next,
    kind,
    playerId,
    tileIndex: wanted,
    tile,
  });
}




