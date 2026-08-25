import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesPending,
} from '../../model/contes-et-cacahuetes-state.model';
import type { RandomService } from '../../../../../core/application/services/random.service';

export type ContesProgressionDeps = {
  random: RandomService;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  autoSkipIfBlocked: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  canUseBonusCards: (state: GameStateEntity, playerId: number) => boolean;
  endTurn: (state: GameStateEntity, playerId: number) => GameStateEntity;
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
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
  drawAndApply: (
    state: GameStateEntity,
    playerId: number,
    type: ContesCardType,
    depth: number,
  ) => GameStateEntity;
  buildConteNarrationFromTile: (
    tile: ContesCacahuetesTile,
  ) => ContesCard | null;
  recordConteNarration: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  maybeProtectFromMalus: (
    state: GameStateEntity,
    playerId: number,
  ) => { state: GameStateEntity; protected: boolean };
  startChooseTarget: (
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ) => GameStateEntity;
};

export function handleContesRoll(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
): GameStateEntity {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return state;
  if (state.pending) return state;

  const currentId = state.turn?.currentPlayerId ?? null;
  if (currentId == null) return state;

  let next = deps.autoSkipIfBlocked(state, currentId);
  if ((next.turn?.currentPlayerId ?? null) !== currentId) return next;

  const meta = deps.getMeta(next);
  const forced = Number(meta.statuses.forcedRollOneTurns?.[currentId] ?? 0);
  const rollOut =
    forced > 0 ? { roll: 1, meta } : deps.random.rollDice(meta, 6);
  next = {
    ...next,
    metadata: { ...(next.metadata ?? {}), ...rollOut.meta },
    lastRoll: rollOut.roll,
  };

  if (forced > 0) {
    next = deps.setStatusCount(
      next,
      'forcedRollOneTurns',
      currentId,
      forced - 1,
    );
  }

  next = deps.appendLog(
    next,
    `${resolvePlayerNameFromState(next, currentId)} lance le dé : "${rollOut.roll}".`,
  );

  const rerollToken = Number(
    deps.getMeta(next).statuses.rerollToken?.[currentId] ?? 0,
  );
  if (rerollToken > 0 && deps.canUseBonusCards(next, currentId)) {
    next = deps.setStatusCount(next, 'rerollToken', currentId, rerollToken - 1);
    return deps.setPending(next, {
      type: 'reroll',
      label:
        'Parchemin enchanté : relancer le dé ? (Relancer/Garder)',
      playerId: currentId,
      blocking: true,
      choices: ['Relancer', 'Garder'],
      data: { baseRoll: rollOut.roll },
    });
  }

  next = applyContesMoveFromRoll(deps, next, currentId, rollOut.roll, 0);
  if (String(next.status ?? '').toLowerCase() === 'finished') return next;
  if (next.pending) return next;
  return deps.endTurn(next, currentId);
}

export function applyContesMoveFromRoll(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
  playerId: number,
  roll: number,
  depth: number,
): GameStateEntity {
  let next = state;
  const meta = deps.getMeta(next);
  const reverse = Boolean(meta.statuses.reverseNextTurn?.[playerId]);
  if (reverse) {
    next = deps.setStatusBool(next, 'reverseNextTurn', playerId, false);
  }

  let effectiveRoll = roll;
  const replace = Boolean(meta.statuses.replaceOneOn1By4?.[playerId]);
  if (roll === 1 && replace && deps.canUseBonusCards(next, playerId)) {
    effectiveRoll = 4;
    next = deps.setStatusBool(next, 'replaceOneOn1By4', playerId, false);
    next = deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} utilise Feuille magique : 1 devient 4.`,
    );
  }

  const delta = reverse ? -effectiveRoll : effectiveRoll;
  return moveContesBy(deps, next, playerId, delta, depth);
}

export function moveContesBy(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
  playerId: number,
  delta: number,
  depth: number,
): GameStateEntity {
  if (!delta) return state;
  if (depth > 10) {
    return deps.appendLog(state, 'Effet en chaîne interrompu.');
  }

  const meta = deps.getMeta(state);
  const tilesLen = Array.isArray(meta.tiles) ? meta.tiles.length : 60;
  const finishIndex = Math.max(0, tilesLen - 1);
  const current = meta.positions?.[playerId] ?? 0;
  const raw = current + delta;
  const nextPos = raw >= finishIndex ? finishIndex : raw < 0 ? 0 : raw;

  let next: GameStateEntity = {
    ...state,
    metadata: {
      ...(state.metadata ?? {}),
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
    },
  };

  next = deps.onAnyPlayerPassedBlocked(next, playerId, nextPos);

  const tile = (deps.getMeta(next).tiles ?? [])[nextPos] as
    | ContesCacahuetesTile
    | undefined;
  next = deps.appendTileArrivalLog(next, playerId, nextPos, tile);
  if (raw >= finishIndex) {
    next = deps.setWinner(next, playerId);
    next = deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} remporte la partie !`,
    );
    return { ...next, status: 'finished' };
  }

  if (!tile) return next;
  return applyContesTileEffect(deps, next, playerId, tile, depth + 1);
}

export function applyContesTileEffect(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
  playerId: number,
  tile: ContesCacahuetesTile,
  depth: number,
): GameStateEntity {
  if (tile.type === 'bonus')
    return deps.drawAndApply(state, playerId, 'bonus', depth);
  if (tile.type === 'malus')
    return deps.drawAndApply(state, playerId, 'malus', depth);
  if (tile.type === 'surprise') {
    return deps.drawAndApply(state, playerId, 'surprise', depth);
  }
  if (tile.type === 'conte')
    return applyContesConteTile(deps, state, playerId, tile, depth);
  return state;
}

export function applyContesConteTile(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
  playerId: number,
  tile: ContesCacahuetesTile,
  depth: number,
): GameStateEntity {
  const meta = deps.getMeta(state);
  const key = Boolean(meta.statuses.keyOfGold?.[playerId]);
  if (key && deps.canUseBonusCards(state, playerId)) {
    return deps.startChooseTarget(
      state,
      playerId,
      'key_gold_choose_target',
      'Clé d’or : choisissez un joueur.',
    );
  }

  const conte = deps.buildConteNarrationFromTile(tile);
  if (!conte) {
    return deps.drawAndApply(state, playerId, 'conte', depth);
  }

  return deps.recordConteNarration(state, playerId, conte);
}

export function drawAndApplyContesCard(
  deps: ContesProgressionDeps,
  state: GameStateEntity,
  playerId: number,
  type: ContesCardType,
  depth: number,
): GameStateEntity {
  const drawLabel =
    type === 'bonus'
      ? 'Piochez une carte Bonus.'
      : type === 'malus'
        ? 'Piochez une carte Malus.'
        : type === 'surprise'
          ? 'Piochez une carte Surprise.'
          : '';
  if (type === 'malus') {
    const meta = deps.getMeta(state);
    const ignore = Boolean(meta.statuses.ignoreNextConteAndAdvance?.[playerId]);
    if (ignore && deps.canUseBonusCards(state, playerId)) {
      let next = deps.setStatusBool(
        state,
        'ignoreNextConteAndAdvance',
        playerId,
        false,
      );
      next = deps.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ignore l’effet Malus (Cape d’invisibilité) et avance d’1 case.`,
      );
      return deps.moveBy(next, playerId, 1, depth);
    }

    const protectedOut = deps.maybeProtectFromMalus(state, playerId);
    if (protectedOut.protected) {
      return deps.appendLog(
        protectedOut.state,
        `${resolvePlayerNameFromState(state, playerId)} est protégé du Malus.`,
      );
    }
  }

  const withPrompt = drawLabel ? deps.appendLog(state, drawLabel) : state;
  const pending: ContesPending = {
    type: 'draw',
    label: `Piocher une carte ${type.toUpperCase()} (Espace).`,
    playerId,
    blocking: true,
    data: {
      context: 'draw_and_apply',
      cardType: type,
      depth,
    },
  };
  return deps.setPending(withPrompt, pending);
}

export function announceContesDrawnCard(
  deps: Pick<ContesProgressionDeps, 'appendLog' | 'recordConteNarration'>,
  state: GameStateEntity,
  playerId: number,
  card: ContesCard,
): GameStateEntity {
  const stateWithLastDraw = {
    ...state,
    lastDraw: { playerId, at: new Date().toISOString() },
  };
  const typeLabel =
    card.type === 'bonus'
      ? 'Bonus'
      : card.type === 'malus'
        ? 'Malus'
        : card.type === 'surprise'
          ? 'Surprise'
          : 'Conte';
  const baseMessage = `${resolvePlayerNameFromState(
    stateWithLastDraw,
    playerId,
  )} pioche une carte ${typeLabel} : ${card.title}.`;

  if (card.type === 'conte') {
    const next = deps.appendLog(stateWithLastDraw, baseMessage);
    return deps.recordConteNarration(next, playerId, card);
  }

  return deps.appendLog(stateWithLastDraw, `${baseMessage} ${card.text}`);
}
