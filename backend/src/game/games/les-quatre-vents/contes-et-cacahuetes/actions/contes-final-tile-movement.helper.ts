import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
} from '../model/contes-et-cacahuetes-state.model';

export function moveContesByToFinalTile(input: {
  state: GameStateEntity;
  playerId: number;
  delta: number;
  depth: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  onAnyPlayerPassedBlocked: (
    state: GameStateEntity,
    playerId: number,
    nextPos: number,
  ) => GameStateEntity;
  appendTileArrivalLog: (
    state: GameStateEntity,
    playerId: number,
    nextPos: number,
    tile: ContesCacahuetesTile | undefined,
  ) => GameStateEntity;
  setWinner: (state: GameStateEntity, playerId: number) => GameStateEntity;
  applyTileEffect: (
    state: GameStateEntity,
    playerId: number,
    tile: ContesCacahuetesTile,
    depth: number,
  ) => GameStateEntity;
}): GameStateEntity {
  if (!input.delta) return input.state;
  if (input.depth > 10) {
    return input.appendLog(input.state, 'Effet en chaîne interrompu.');
  }

  const meta = input.getMeta(input.state);
  const tilesLen = Array.isArray(meta.tiles) ? meta.tiles.length : 60;
  const finishIndex = Math.max(0, tilesLen - 1);
  const current = Number(meta.positions?.[input.playerId] ?? 0);
  const raw = current + input.delta;
  const nextPos = raw >= finishIndex ? finishIndex : raw < 0 ? 0 : raw;

  let next: GameStateEntity = {
    ...input.state,
    metadata: {
      ...(input.state.metadata ?? {}),
      ...meta,
      positions: { ...(meta.positions ?? {}), [input.playerId]: nextPos },
    },
  };

  next = input.onAnyPlayerPassedBlocked(next, input.playerId, nextPos);

  const tile = (input.getMeta(next).tiles ?? [])[nextPos] as
    | ContesCacahuetesTile
    | undefined;
  next = input.appendTileArrivalLog(next, input.playerId, nextPos, tile);
  if (raw >= finishIndex) {
    next = input.setWinner(next, input.playerId);
    next = input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.playerId)} remporte la partie !`,
    );
    return { ...next, status: 'finished' };
  }

  if (!tile) return next;
  return input.applyTileEffect(next, input.playerId, tile, input.depth + 1);
}

export function appendContesTileArrivalLog(input: {
  state: GameStateEntity;
  playerId: number;
  nextPos: number;
  tile: ContesCacahuetesTile | undefined;
  describePlayerPawn: (state: GameStateEntity, playerId: number) => string;
  formatArrivalTarget: (label: string) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const labelRaw = String(input.tile?.label ?? '').trim();
  const descriptionRaw = String(input.tile?.description ?? '').trim();
  const label = labelRaw
    ? /^(case|départ|arrivée)\b/i.test(labelRaw)
      ? labelRaw
      : `Case ${input.nextPos + 1} - ${labelRaw}`
    : `Case ${input.nextPos + 1}`;
  const pawnLabel = input.describePlayerPawn(input.state, input.playerId);
  const arrivalMessage = pawnLabel
    ? `${resolvePlayerNameFromState(input.state, input.playerId)} déplace ${pawnLabel} ${input.formatArrivalTarget(label)}.`
    : `${resolvePlayerNameFromState(input.state, input.playerId)} arrive sur ${label}.`;
  let next = input.appendLog(input.state, arrivalMessage);
  const tileType = String(input.tile?.type ?? '').toLowerCase();
  const isConteTile = tileType === 'conte';
  if (descriptionRaw && !isConteTile) {
    next = input.appendLog(next, descriptionRaw);
  }
  return next;
}




