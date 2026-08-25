import { fixMojibakeDeep } from '../../../../../common/utils/public-api';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type {
  ContesCacahuetesMetadata,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.model';

type StatusMap = Record<string, Record<number, unknown>>;

export function decrementContesStatusPerTurn(input: {
  state: GameStateEntity;
  playerId: number;
  key: keyof ContesCacahuetesMetadata['statuses'];
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  getStatusMap: (
    meta: ContesCacahuetesMetadata,
    key: keyof ContesCacahuetesMetadata['statuses'],
  ) => Record<number, unknown>;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const map = input.getStatusMap(meta, input.key);
  const current = Number(map[input.playerId] ?? 0);
  if (!Number.isFinite(current) || current <= 0) return input.state;
  return input.setStatusCount(
    input.state,
    String(input.key),
    input.playerId,
    current - 1,
  );
}

export function setContesPendingState(
  state: GameStateEntity,
  pending: Exclude<ContesPending, null>,
): GameStateEntity {
  return { ...state, pending: fixMojibakeDeep(pending) };
}

export function setContesStatusCount(input: {
  state: GameStateEntity;
  key: string;
  playerId: number;
  value: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const statuses = meta.statuses as unknown as StatusMap;
  const map = { ...(statuses[input.key] ?? {}) };
  if (!input.value) delete map[input.playerId];
  else map[input.playerId] = input.value;
  return {
    ...input.state,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...meta,
      statuses: { ...statuses, [input.key]: map },
    },
  };
}

export function setContesStatusBool(input: {
  state: GameStateEntity;
  key: string;
  playerId: number;
  value: boolean;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const statuses = meta.statuses as unknown as StatusMap;
  const map = { ...(statuses[input.key] ?? {}) };
  if (!input.value) delete map[input.playerId];
  else map[input.playerId] = true;
  return {
    ...input.state,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...meta,
      statuses: { ...statuses, [input.key]: map },
    },
  };
}

export function addContesStatusCount(input: {
  state: GameStateEntity;
  key: string;
  playerId: number;
  delta: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const statuses = meta.statuses as unknown as StatusMap;
  const map = { ...(statuses[input.key] ?? {}) };
  const current = Number(map[input.playerId] ?? 0);
  map[input.playerId] = (Number.isFinite(current) ? current : 0) + input.delta;
  return {
    ...input.state,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...meta,
      statuses: { ...statuses, [input.key]: map },
    },
  };
}

export function getContesStatusMap(
  meta: ContesCacahuetesMetadata,
  key: keyof ContesCacahuetesMetadata['statuses'],
): Record<number, unknown> {
  const statuses = meta.statuses as unknown as StatusMap;
  return statuses[String(key)] ?? {};
}




