import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import type { RandomService } from '../../../../../application/services/random.service';
import type { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesPending,
} from '../../model/contes-et-cacahuetes-state.model';
import type { ContesProgressionDeps } from './contes-progression.utils';
import type { ContesCardFlowDeps } from './contes-card-flow.utils';

type BaseDepsCallbacks = {
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
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
  canUseBonusCards: (state: GameStateEntity, playerId: number) => boolean;
  endTurn: (state: GameStateEntity, playerId: number) => GameStateEntity;
};

export function buildContesProgressionDeps(callbacks: BaseDepsCallbacks & {
  random: RandomService;
  autoSkipIfBlocked: (state: GameStateEntity, playerId: number) => GameStateEntity;
  onAnyPlayerPassedBlocked: (
    state: GameStateEntity,
    playerId: number,
    nextPos: number,
  ) => GameStateEntity;
  appendTileArrivalLog: (
    state: GameStateEntity,
    playerId: number,
    nextPos: number,
    tile: unknown,
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
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
    depth: number,
  ) => GameStateEntity;
  buildConteNarrationFromTile: (tile: unknown) => ContesCard | null;
  recordConteNarration: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  maybeProtectFromMalus: (
    state: GameStateEntity,
    playerId: number,
  ) => { protected: boolean; state: GameStateEntity };
  startChooseTarget: (
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ) => GameStateEntity;
}): ContesProgressionDeps {
  return {
    random: callbacks.random,
    getMeta: callbacks.getMeta,
    setStatusCount: callbacks.setStatusCount,
    setStatusBool: callbacks.setStatusBool,
    setPending: callbacks.setPending,
    appendLog: callbacks.appendLog,
    autoSkipIfBlocked: callbacks.autoSkipIfBlocked,
    canUseBonusCards: callbacks.canUseBonusCards,
    endTurn: callbacks.endTurn,
    onAnyPlayerPassedBlocked: callbacks.onAnyPlayerPassedBlocked,
    appendTileArrivalLog: callbacks.appendTileArrivalLog,
    setWinner: callbacks.setWinner,
    moveBy: callbacks.moveBy,
    drawAndApply: callbacks.drawAndApply,
    buildConteNarrationFromTile: callbacks.buildConteNarrationFromTile,
    recordConteNarration: callbacks.recordConteNarration,
    maybeProtectFromMalus: callbacks.maybeProtectFromMalus,
    startChooseTarget: callbacks.startChooseTarget,
  };
}

export function buildContesCardFlowDeps(callbacks: BaseDepsCallbacks & {
  random: RandomService;
  deckPolicies: DeckPoliciesService;
  queueDraws: (
    state: GameStateEntity,
    playerId: number,
    queue: Array<'bonus' | 'malus' | 'surprise' | 'conte'>,
    depth: number,
    label?: string,
  ) => GameStateEntity;
  attachQueuedDrawContinuationFromPending: (
    state: GameStateEntity,
    pending: ContesPending | null,
  ) => GameStateEntity;
  resumeQueuedDrawContinuation: (
    state: GameStateEntity,
    pending: ContesPending | null,
  ) => GameStateEntity;
}): ContesCardFlowDeps {
  return {
    random: callbacks.random,
    deckPolicies: callbacks.deckPolicies,
    getMeta: callbacks.getMeta,
    setPending: callbacks.setPending,
    setStatusBool: callbacks.setStatusBool,
    setStatusCount: callbacks.setStatusCount,
    appendLog: callbacks.appendLog,
    queueDraws: callbacks.queueDraws,
    endTurn: callbacks.endTurn,
    attachQueuedDrawContinuationFromPending:
      callbacks.attachQueuedDrawContinuationFromPending,
    resumeQueuedDrawContinuation: callbacks.resumeQueuedDrawContinuation,
    canUseBonusCards: callbacks.canUseBonusCards,
  };
}

export function buildContesChoiceDeps(callbacks: {
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  swapPositions: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  setTurnSwap: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  takeOneBonusToken: (
    state: GameStateEntity,
    fromPlayerId: number,
    toPlayerId: number,
  ) => GameStateEntity;
  startStealTokenChoice: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  moveTargetToPlayerAndAdvance: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
    delta: number,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
  startGiveBonusChoice: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
  drawAndApply: (
    state: GameStateEntity,
    playerId: number,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
    depth: number,
  ) => GameStateEntity;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  transferBonusToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: number,
  ) => GameStateEntity;
  transferSurpriseToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: number,
  ) => GameStateEntity;
  findCardTitle: (
    state: GameStateEntity,
    cardType: ContesCardType,
    cardId: number,
  ) => string | null;
}) {
  return {
    appendLog: callbacks.appendLog,
    playerName: (state: GameStateEntity, playerId: number) =>
      resolvePlayerNameFromState(state, playerId),
    swapPositions: callbacks.swapPositions,
    setTurnSwap: callbacks.setTurnSwap,
    takeOneBonusToken: callbacks.takeOneBonusToken,
    startStealTokenChoice: callbacks.startStealTokenChoice,
    moveTargetToPlayerAndAdvance: callbacks.moveTargetToPlayerAndAdvance,
    setPending: callbacks.setPending,
    startGiveBonusChoice: callbacks.startGiveBonusChoice,
    moveBy: callbacks.moveBy,
    drawAndApply: callbacks.drawAndApply,
    setStatusBool: callbacks.setStatusBool,
    applyBonusEffectById: callbacks.applyBonusEffectById,
    transferBonusToken: callbacks.transferBonusToken,
    transferSurpriseToken: callbacks.transferSurpriseToken,
    findCardTitle: callbacks.findCardTitle,
  };
}

export function buildContesDrawResolutionDeps(callbacks: {
  resolveAbondanceDraw: (
    state: GameStateEntity,
    playerId: number,
    data: { remaining?: number; drawn?: ContesCard[]; depth?: number },
  ) => GameStateEntity;
  resolveQueuedDraw: (
    state: GameStateEntity,
    playerId: number,
    data: { queue?: string[]; cardType?: string; depth?: number },
  ) => GameStateEntity;
  maybeProtectFromMalus: (
    state: GameStateEntity,
    playerId: number,
  ) => { protected: boolean; state: GameStateEntity };
  continueQueuedDraw: (
    state: GameStateEntity,
    playerId: number,
    queue: string[],
    depth: number,
  ) => GameStateEntity;
  drawCard: (
    state: GameStateEntity,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
  ) => { state: GameStateEntity; card: ContesCard | null };
  announceDrawnCard: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  applyMalusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  applySurpriseEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  attachQueuedDrawContinuation: (
    state: GameStateEntity,
    queue: string[],
    depth: number,
    playerId: number,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
}) {
  return {
    resolveAbondanceDraw: callbacks.resolveAbondanceDraw,
    resolveQueuedDraw: callbacks.resolveQueuedDraw,
    maybeProtectFromMalus: callbacks.maybeProtectFromMalus,
    continueQueuedDraw: callbacks.continueQueuedDraw,
    drawCard: callbacks.drawCard,
    announceDrawnCard: callbacks.announceDrawnCard,
    applyBonusEffectById: callbacks.applyBonusEffectById,
    applyMalusEffectById: callbacks.applyMalusEffectById,
    applySurpriseEffectById: callbacks.applySurpriseEffectById,
    attachQueuedDrawContinuation: callbacks.attachQueuedDrawContinuation,
    setPending: callbacks.setPending,
  };
}
