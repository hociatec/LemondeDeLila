import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type { SacMetadata } from '../model/sac-a-malices.types';

function updateSacState(
  state: GameStateEntity,
  meta: SacMetadata,
): GameStateEntity {
  return { ...state, metadata: { ...(state.metadata ?? {}), ...meta } };
}

export function setSacPosition(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  pos: number,
  clamp: (value: number, min: number, max: number) => number,
): GameStateEntity {
  const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
  const len = tiles.length || 40;
  const nextPos = clamp(pos, 0, len - 1);
  return updateSacState(state, {
    ...meta,
    positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
  });
}

export function setSacOwner(
  state: GameStateEntity,
  meta: SacMetadata,
  tileIndex: number,
  ownerId: number,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    ownership: { ...(meta.ownership ?? {}), [tileIndex]: ownerId },
  });
}

export function setSacPot(
  state: GameStateEntity,
  meta: SacMetadata,
  value: number,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    pot: Math.max(0, Math.trunc(value)),
  });
}

export function addSacSkipTurn(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  turns: number,
): GameStateEntity {
  const current = meta.statuses?.skipTurn?.[playerId] ?? 0;
  return updateSacState(state, {
    ...meta,
    statuses: {
      ...meta.statuses,
      skipTurn: {
        ...(meta.statuses.skipTurn ?? {}),
        [playerId]: current + turns,
      },
    },
  });
}

export function setSacJailTurns(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  turns: number,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    statuses: {
      ...meta.statuses,
      inJail: {
        ...(meta.statuses.inJail ?? {}),
        [playerId]: Math.max(0, Math.trunc(turns)),
      },
    },
  });
}

export function setSacGetOutOfJailCount(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  count: number,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    statuses: {
      ...meta.statuses,
      getOutOfJail: {
        ...(meta.statuses.getOutOfJail ?? {}),
        [playerId]: Math.max(0, Math.trunc(count)),
      },
    },
  });
}

export function setSacExtraRoll(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  value: boolean,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    statuses: {
      ...meta.statuses,
      extraRoll: {
        ...(meta.statuses.extraRoll ?? {}),
        [playerId]: Boolean(value),
      },
    },
  });
}

export function setSacConsecutiveDoubles(
  state: GameStateEntity,
  meta: SacMetadata,
  playerId: number,
  value: number,
): GameStateEntity {
  return updateSacState(state, {
    ...meta,
    statuses: {
      ...meta.statuses,
      consecutiveDoubles: {
        ...(meta.statuses.consecutiveDoubles ?? {}),
        [playerId]: Math.max(0, Math.trunc(value)),
      },
    },
  });
}




