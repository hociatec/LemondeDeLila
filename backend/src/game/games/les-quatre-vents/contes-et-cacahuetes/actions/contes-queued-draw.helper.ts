import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { ContesPending } from '../model/contes-et-cacahuetes-state.model';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function continueContesQueuedDraw(
  state: GameStateEntity,
  input: {
    playerId: number;
    queue: string[];
    depth: number;
    setPending: (
      state: GameStateEntity,
      pending: Exclude<ContesPending, null>,
    ) => GameStateEntity;
  },
): GameStateEntity {
  if (!input.queue.length) return state;
  return input.setPending(state, {
    type: 'draw',
    label: 'Piocher une carte (Espace).',
    playerId: input.playerId,
    blocking: true,
    data: {
      context: 'draw_and_apply',
      queue: input.queue,
      depth: input.depth,
    },
  });
}

export function queueContesDraws(
  state: GameStateEntity,
  input: {
    playerId: number;
    queue: Array<'bonus' | 'malus' | 'surprise' | 'conte'>;
    depth: number;
    label?: string;
    setPending: (
      state: GameStateEntity,
      pending: Exclude<ContesPending, null>,
    ) => GameStateEntity;
  },
): GameStateEntity {
  if (!input.queue.length) return state;
  return input.setPending(state, {
    type: 'draw',
    label: input.label ?? 'Piocher une carte (Espace).',
    playerId: input.playerId,
    blocking: true,
    data: {
      context: 'draw_and_apply',
      queue: input.queue,
      depth: input.depth,
    },
  });
}

export function extractContesQueuedDrawContinuationData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const queue = Array.isArray(data.queuedDrawQueue)
    ? data.queuedDrawQueue.filter((value) => typeof value === 'string')
    : [];
  const depth = Number.isFinite(data.queuedDrawDepth)
    ? Number(data.queuedDrawDepth)
    : 0;
  if (!queue.length) return {};
  const playerId = Number(data.queuedDrawPlayerId);
  return {
    queuedDrawQueue: [...queue],
    queuedDrawDepth: depth,
    ...(Number.isFinite(playerId) ? { queuedDrawPlayerId: playerId } : {}),
  };
}

export function attachContesQueuedDrawContinuation(
  state: GameStateEntity,
  input: {
    queue: string[];
    depth: number;
    playerId: number;
    setPending: (
      state: GameStateEntity,
      pending: Exclude<ContesPending, null>,
    ) => GameStateEntity;
    extractQueuedDrawContinuationData: (
      data: Record<string, unknown>,
    ) => Record<string, unknown>;
  },
): GameStateEntity {
  if (!input.queue.length || !state.pending) return state;
  const pending = state.pending as Exclude<ContesPending, null>;
  return input.setPending(state, {
    ...pending,
    data: {
      ...(pending.data ?? {}),
      ...input.extractQueuedDrawContinuationData({
        queuedDrawQueue: [...input.queue],
        queuedDrawDepth: input.depth,
        queuedDrawPlayerId: input.playerId,
      }),
    },
  } as Exclude<ContesPending, null>);
}

export function attachContesQueuedDrawContinuationFromPending(
  state: GameStateEntity,
  input: {
    pending: ContesPending | null;
    setPending: (
      state: GameStateEntity,
      pending: Exclude<ContesPending, null>,
    ) => GameStateEntity;
    extractQueuedDrawContinuationData: (
      data: Record<string, unknown>,
    ) => Record<string, unknown>;
  },
): GameStateEntity {
  const continuationData = input.extractQueuedDrawContinuationData(
    (input.pending?.data ?? {}) as Record<string, unknown>,
  );
  if (!Object.keys(continuationData).length || !state.pending) return state;
  const nextPending = state.pending as Exclude<ContesPending, null>;
  return input.setPending(state, {
    ...nextPending,
    data: {
      ...(nextPending.data ?? {}),
      ...continuationData,
    },
  } as Exclude<ContesPending, null>);
}

export function resumeContesQueuedDrawContinuation(
  state: GameStateEntity,
  input: {
    pending: ContesPending | null;
    continueQueuedDraw: (
      state: GameStateEntity,
      playerId: number,
      queue: string[],
      depth: number,
    ) => GameStateEntity;
  },
): GameStateEntity {
  const pendingData = asRecord(input.pending?.data) as {
    queuedDrawQueue?: unknown;
    queuedDrawDepth?: unknown;
    queuedDrawPlayerId?: unknown;
  };
  const queue = Array.isArray(pendingData.queuedDrawQueue)
    ? pendingData.queuedDrawQueue.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  const depth = Number.isFinite(pendingData.queuedDrawDepth)
    ? Number(pendingData.queuedDrawDepth)
    : 0;
  if (!queue.length) return state;
  const queuedPlayerId = Number(pendingData.queuedDrawPlayerId);
  const playerId = Number.isFinite(queuedPlayerId)
    ? queuedPlayerId
    : typeof input.pending?.playerId === 'number'
      ? input.pending.playerId
      : null;
  if (playerId == null) return state;
  return input.continueQueuedDraw(state, playerId, queue, depth);
}
