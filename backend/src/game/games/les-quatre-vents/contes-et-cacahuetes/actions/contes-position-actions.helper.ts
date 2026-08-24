import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
} from '../model/contes-et-cacahuetes-state.model';

export function swapContesPositions(input: {
  state: GameStateEntity;
  aId: number;
  bId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const positions = { ...(meta.positions ?? {}) };
  const a = positions[input.aId] ?? 0;
  const b = positions[input.bId] ?? 0;
  positions[input.aId] = b;
  positions[input.bId] = a;
  let next: GameStateEntity = {
    ...input.state,
    metadata: { ...(input.state.metadata ?? {}), ...meta, positions },
  };
  next = input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, input.aId)} échange sa position avec ${resolvePlayerNameFromState(next, input.bId)}.`,
  );
  return next;
}

export function moveContesTargetToPlayerAndAdvance(input: {
  state: GameStateEntity;
  ownerId: number;
  targetId: number;
  deltaAfterMove: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const positions = { ...(meta.positions ?? {}) };
  const ownerPos = positions[input.ownerId] ?? 0;
  positions[input.targetId] = ownerPos;
  let next: GameStateEntity = {
    ...input.state,
    metadata: { ...(input.state.metadata ?? {}), ...meta, positions },
  };
  next = input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, input.targetId)} prend la position de ${resolvePlayerNameFromState(next, input.ownerId)}.`,
  );
  if (!input.deltaAfterMove) return next;
  next = input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, input.targetId)} avance d’1 case.`,
  );
  return input.moveBy(next, input.targetId, input.deltaAfterMove, 0);
}

export function setContesTurnSwap(input: {
  state: GameStateEntity;
  aId: number;
  bId: number;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  next = input.setStatusCount(next, 'turnSwapWith', input.aId, input.bId);
  next = input.setStatusCount(next, 'turnSwapWith', input.bId, input.aId);
  next = input.setStatusCount(next, 'turnSwapRemaining', input.aId, 1);
  next = input.setStatusCount(next, 'turnSwapRemaining', input.bId, 1);
  return input.appendLog(
    next,
    `Formule magique : prochains tours échangés entre ${resolvePlayerNameFromState(next, input.aId)} et ${resolvePlayerNameFromState(next, input.bId)}.`,
  );
}

export function clearContesBlockedPlayers(input: {
  state: GameStateEntity;
  moverId: number;
  moverPos: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  const meta = input.getMeta(next);
  const blocked = { ...(meta.statuses.blockedUntilPassed ?? {}) };
  const toClear: number[] = [];
  for (const [rawPlayerId, threshold] of Object.entries(blocked)) {
    const playerId = Number(rawPlayerId);
    if (!Number.isFinite(playerId) || playerId === input.moverId) continue;
    if (typeof threshold !== 'number') continue;
    if (input.moverPos >= threshold) toClear.push(playerId);
  }
  if (!toClear.length) return next;
  for (const playerId of toClear) {
    delete blocked[playerId];
    next = input.setStatusCount(next, 'skipTurn', playerId, 0);
    next = input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} n’est plus bloqué(e).`,
    );
  }
  return {
    ...next,
    metadata: {
      ...(next.metadata ?? {}),
      ...meta,
      statuses: { ...meta.statuses, blockedUntilPassed: blocked },
    },
  };
}

export function setContesWinner(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const updated: ContesCacahuetesMetadata = { ...meta, winnerId: input.playerId };
  return { ...input.state, metadata: { ...(input.state.metadata ?? {}), ...updated } };
}

export function swapContesWithClosestBehind(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  swapPositions: (
    state: GameStateEntity,
    aId: number,
    bId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const myPos = meta.positions?.[input.playerId] ?? 0;
  const players = Array.isArray(input.state.players) ? input.state.players : [];
  const behind = players
    .map((player) => player.id)
    .filter((id) => id !== input.playerId)
    .map((id) => ({ id, pos: meta.positions?.[id] ?? 0 }))
    .filter((entry) => entry.pos < myPos)
    .sort((a, b) => b.pos - a.pos);
  if (!behind.length) {
    return input.appendLog(input.state, 'Aucun joueur derrière vous.');
  }
  return input.swapPositions(input.state, input.playerId, behind[0].id);
}

export function blockContesUntilPassed(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const pos = meta.positions?.[input.playerId] ?? 0;
  let next = input.state;
  next = input.setStatusCount(next, 'blockedUntilPassed', input.playerId, pos);
  next = input.setStatusCount(next, 'skipTurn', input.playerId, 999);
  return input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, input.playerId)} est bloqué(e) jusqu’à ce qu’un autre joueur atteigne ou dépasse sa case.`,
  );
}

export function teleportContesPlayer(input: {
  state: GameStateEntity;
  playerId: number;
  pos: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const clamped = Math.max(
    0,
    Math.min(input.pos, (meta.tiles?.length ?? 60) - 1),
  );
  return {
    ...input.state,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...meta,
      positions: { ...(meta.positions ?? {}), [input.playerId]: clamped },
    },
  };
}

export function goToContesPreviousMalusAndApply(input: {
  state: GameStateEntity;
  playerId: number;
  depth: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  teleport: (
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  applyTileEffect: (
    state: GameStateEntity,
    playerId: number,
    tile: ContesCacahuetesTile,
    depth: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const pos = meta.positions?.[input.playerId] ?? 0;
  const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
  let idx = -1;
  for (let i = pos - 1; i >= 0; i -= 1) {
    if (tiles[i]?.type === 'malus') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return input.state;
  let next = input.teleport(input.state, input.playerId, idx);
  next = input.appendLog(
    next,
    `Passage obscur : retour à la case Malus ${idx + 1}.`,
  );
  return input.applyTileEffect(next, input.playerId, tiles[idx], input.depth + 1);
}




