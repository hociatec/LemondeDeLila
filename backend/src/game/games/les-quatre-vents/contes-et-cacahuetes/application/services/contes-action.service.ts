import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../../../application/services/turn-policies.service';
import { continueSequentialPawnSelection } from '../../../../../application/helpers/sequential-pawn-selection.helper';
import { applyConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-selection.helper';
import { fixMojibakeDeep } from '../../../../../../common/utils/mojibake';
import { applyContesDrawAction } from '../../actions/contes-draw-action.helper';
import {
  resolveContesAbondanceDraw,
  resolveContesQueuedDraw,
} from '../../actions/contes-draw-resolution.helper';
import {
  applyContesBonusEffectById,
  applyContesMalusEffectById,
  applyContesSurpriseEffectById,
} from '../../actions/contes-card-effects.helper';
import {
  applyContesChooseCard,
  applyContesChooseNumber,
  applyContesChooseOption,
} from '../../actions/contes-choice-resolution.helper';
import {
  appendContesTileArrivalLog,
  moveContesByToFinalTile,
} from '../../actions/contes-final-tile-movement.helper';
import {
  blockContesUntilPassed,
  clearContesBlockedPlayers,
  goToContesPreviousMalusAndApply,
  setContesWinner,
  swapContesWithClosestBehind,
  teleportContesPlayer,
} from '../../actions/contes-position-actions.helper';
import {
  attachContesQueuedDrawContinuation,
  attachContesQueuedDrawContinuationFromPending,
  continueContesQueuedDraw,
  extractContesQueuedDrawContinuationData,
  queueContesDraws,
  resumeContesQueuedDrawContinuation,
} from '../../actions/contes-queued-draw.helper';
import { applyContesRerollDecision } from '../../actions/contes-reroll-action.helper';
import {
  findContesCardTitle,
  moveContesTargetToPlayerAndAdvance,
  setContesTurnSwap,
  startContesStealTokenChoice,
  swapContesPositions,
  takeOneContesBonusToken,
  transferContesBonusToken,
  transferContesSurpriseToken,
} from '../../actions/contes-token-actions.helper';
import {
  applyContesTurnSwapIfNeeded,
  autoSkipContesBlockedPlayer,
  endContesTurn,
  restoreContesTurnSwapSlotBeforeAdvance,
} from '../../actions/contes-turn-resolution.helper';
import {
  addContesStatusCount,
  decrementContesStatusPerTurn,
  getContesStatusMap,
  setContesPendingState,
  setContesStatusBool,
  setContesStatusCount,
} from '../../actions/contes-status-state.helper';
import { applyContesTargetChoice } from '../../actions/contes-target-choice.helper';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesNarration,
  ContesPending,
} from '../../model/contes-et-cacahuetes-state.model';
import { ContesTargetingService } from './contes-targeting.service';
import {
  buildContesNarrationFromTile,
  describeContesPlayerPawn,
  formatContesArrivalTarget,
  recordContesNarrationState,
  toContesCardArray,
  toContesText,
} from './contes-action.utils';
import {
  announceContesDrawnCard,
  applyContesMoveFromRoll,
  type ContesProgressionDeps,
  drawAndApplyContesCard,
  handleContesRoll,
  moveContesBy,
} from './contes-progression.utils';
import {
  applyContesAbondance,
  applyContesCoffreMerveilles,
  type ContesCardFlowDeps,
  drawContesCard,
  finalizeContesPendingResolution,
  protectContesPlayerFromMalus,
} from './contes-card-flow.utils';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import {
  buildContesCardFlowDeps,
  buildContesChoiceDeps,
  buildContesDrawResolutionDeps,
  buildContesProgressionDeps,
} from './contes-action-deps.utils';

export class ContesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly setupFlow: SetupFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly targeting: ContesTargetingService,
    private readonly turnPolicies?: TurnPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          choose_pawn: () => {
            next = this.handleChoosePawn(next, action);
            return next;
          },
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
          reroll_yes: () => {
            next = this.handleRerollDecision(next, type === 'reroll_yes');
            return next;
          },
          reroll_no: () => {
            next = this.handleRerollDecision(next, type === 'reroll_yes');
            return next;
          },
          choose_target: () => {
            const before = next;
            next = applyContesTargetChoice({
              state: next,
              action,
              ...this.getChoiceDeps(),
            });
            next = this.finalizePendingResolution(before, next);
            return next;
          },
          choose_number: () => {
            const before = next;
            next = applyContesChooseNumber({
              state: next,
              action,
              ...this.getChoiceDeps(),
              extractQueuedDrawContinuationData: (data) =>
                extractContesQueuedDrawContinuationData(data),
            });
            next = this.finalizePendingResolution(before, next);
            return next;
          },
          choose_option: () => {
            const before = next;
            next = applyContesChooseOption({
              state: next,
              action,
              ...this.getChoiceDeps(),
            });
            next = this.finalizePendingResolution(before, next);
            return next;
          },
          draw: () => {
            const before = next;
            next = applyContesDrawAction({
              state: next,
              ...this.getDrawResolutionDeps(),
            });
            next = this.finalizePendingResolution(before, next);
            return next;
          },
          choose_card: () => {
            const before = next;
            next = applyContesChooseCard({
              state: next,
              action,
              ...this.getChoiceDeps(),
            });
            next = this.finalizePendingResolution(before, next);
            return next;
          },
        },
        () => next,
      );
    });
    return fixMojibakeDeep(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: this.setupFlow,
      core: this.core,
      pendingType: 'choose_pawn',
      metadataCatalogKey: 'pawns',
      playerPawnField: 'pawn',
    });
    if (!applied) return state;
    const { playerId } = applied;
    const next = applied.state;

    const starterId =
      typeof this.getMeta(next).setupStarterId === 'number'
        ? this.getMeta(next).setupStarterId!
        : (state.turn?.currentPlayerId ?? null);
    const playersForPending = Array.isArray(next.players) ? next.players : [];
    const usedForPending = new Set(
      playersForPending
        .map((p) => toContesText(p?.pawn))
        .filter((p: string) => p.length > 0),
    );
    const pawns = this.getMeta(next).pawns;
    const pawnCatalog = Array.isArray(pawns)
      ? pawns.filter(
          (
            pawn,
          ): pawn is NonNullable<ContesCacahuetesMetadata['pawns']>[number] =>
            pawn != null,
        )
      : [];
    const choicesForPending = pawnCatalog
      .filter((pawn) => !usedForPending.has(pawn.id))
      .map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
      }));
    const started = continueSequentialPawnSelection({
      state: next,
      setupFlow: this.setupFlow,
      core: this.core,
      chooserPlayerId: playerId,
      players: playersForPending,
      isAssigned: (candidateId) => {
        const player = playersForPending.find((p) => p?.id === candidateId);
        return toContesText(player?.pawn).length > 0;
      },
      pawns: choicesForPending,
      choiceLabelBuilder: (pawn) =>
        toContesText(pawn.description).trim().length > 0
          ? `${toContesText(pawn.label).trim()}: ${toContesText(pawn.description).trim()}`
          : toContesText(pawn.label).trim(),
      pawnDataMapper: (choice) => ({
        id: toContesText(choice.id).trim(),
        label: toContesText(choice.label).trim(),
        description: toContesText(choice.description).trim(),
      }),
      starterId,
      onStarted: (startedState, starterPlayerId) =>
        this.appendTurnAnnouncement(startedState, starterPlayerId),
    });
    return started;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    return handleContesRoll(this.getProgressionDeps(), state);
  }

  private handleRerollDecision(
    state: GameStateEntity,
    reroll: boolean,
  ): GameStateEntity {
    return applyContesRerollDecision({
      state,
      reroll,
      getMeta: (value) => this.getMeta(value),
      rollDice: (meta, sides) => this.random.rollDice(meta, sides),
      appendLog: (value, message) => this.core.appendLog(value, message),
      applyMoveFromRoll: (value, playerId, roll, bonus) =>
        this.applyMoveFromRoll(value, playerId, roll, bonus),
      endTurn: (value, playerId) => this.endTurn(value, playerId),
    });
  }

  private applyMoveFromRoll(
    state: GameStateEntity,
    playerId: number,
    roll: number,
    depth: number,
  ): GameStateEntity {
    return applyContesMoveFromRoll(
      this.getProgressionDeps(),
      state,
      playerId,
      roll,
      depth,
    );
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    return moveContesBy(this.getProgressionDeps(), state, playerId, delta, depth);
  }

  private applyTileEffect(
    state: GameStateEntity,
    playerId: number,
    tile: ContesCacahuetesTile,
    depth: number,
  ): GameStateEntity {
    if (tile.type === 'bonus')
      return this.drawAndApply(state, playerId, 'bonus', depth);
    if (tile.type === 'malus')
      return this.drawAndApply(state, playerId, 'malus', depth);
    if (tile.type === 'surprise')
      return this.drawAndApply(state, playerId, 'surprise', depth);
    if (tile.type === 'conte')
      return this.applyConteTile(state, playerId, tile, depth);
    return state;
  }

  private applyConteTile(
    state: GameStateEntity,
    playerId: number,
    tile: ContesCacahuetesTile,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);

    const key = Boolean(meta.statuses.keyOfGold?.[playerId]);
    if (key && this.canUseBonusCards(state, playerId)) {
      return this.targeting.startChooseTarget(
        state,
        playerId,
        'key_gold_choose_target',
        'ClÃƒÂ© dÃ¢â‚¬â„¢or : choisissez un joueur.',
      );
    }

    const conte = buildContesNarrationFromTile(tile);
    if (!conte) {
      return this.drawAndApply(state, playerId, 'conte', depth);
    }

    return recordContesNarrationState(state, this.getMeta(state), playerId, conte);
  }

  private drawAndApply(
    state: GameStateEntity,
    playerId: number,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
    depth: number,
  ): GameStateEntity {
    return drawAndApplyContesCard(
      this.getProgressionDeps(),
      state,
      playerId,
      type,
      depth,
    );
  }

  private resolveQueuedDraw(
    state: GameStateEntity,
    playerId: number,
    data: { queue?: string[]; cardType?: string; depth?: number },
  ): GameStateEntity {
    return resolveContesQueuedDraw({
      state,
      playerId,
      data,
      ...this.getDrawResolutionDeps(),
    });
  }

  private continueQueuedDraw(
    state: GameStateEntity,
    playerId: number,
    queue: string[],
    depth: number,
  ): GameStateEntity {
    return continueContesQueuedDraw(state, { playerId, queue, depth, ...this.getDrawResolutionDeps() });
  }

  private queueDraws(
    state: GameStateEntity,
    playerId: number,
    queue: Array<'bonus' | 'malus' | 'surprise' | 'conte'>,
    depth: number,
    label: string = 'Piocher une carte (Espace).',
  ): GameStateEntity {
    return queueContesDraws(state, { playerId, queue, depth, label, ...this.getDrawResolutionDeps() });
  }

  private resolveAbondanceDraw(
    state: GameStateEntity,
    playerId: number,
    data: { remaining?: number; drawn?: ContesCard[]; depth?: number },
  ): GameStateEntity {
    return resolveContesAbondanceDraw({
      state,
      playerId,
      data,
      ...this.getDrawResolutionDeps(),
    });
  }

  // --- Effects + helpers (added in next patches) ---

  private announceDrawnCard(
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ): GameStateEntity {
    return announceContesDrawnCard(
      {
        appendLog: (value, message) => this.core.appendLog(value, message),
        recordConteNarration: (value, targetPlayerId, drawnCard) =>
          recordContesNarrationState(
            value,
            this.getMeta(value),
            targetPlayerId,
            drawnCard,
          ),
      },
      state,
      playerId,
      card,
    );
  }

  private attachQueuedDrawContinuation(
    state: GameStateEntity,
    queue: string[],
    depth: number,
    playerId: number,
  ): GameStateEntity {
    return attachContesQueuedDrawContinuation(state, {
      queue,
      depth,
      playerId,
      setPending: (current, pending) => this.setPending(current, pending),
      extractQueuedDrawContinuationData: (data) =>
        extractContesQueuedDrawContinuationData(data),
    });
  }

  private attachQueuedDrawContinuationFromPending(
    state: GameStateEntity,
    pending: ContesPending | null,
  ): GameStateEntity {
    return attachContesQueuedDrawContinuationFromPending(state, {
      pending,
      setPending: (current, nextPending) => this.setPending(current, nextPending),
      extractQueuedDrawContinuationData: (data) =>
        extractContesQueuedDrawContinuationData(data),
    });
  }

  private resumeQueuedDrawContinuation(
    state: GameStateEntity,
    pending: ContesPending | null,
  ): GameStateEntity {
    return resumeContesQueuedDrawContinuation(state, {
      pending,
      continueQueuedDraw: (current, playerId, queue, depth) =>
        this.continueQueuedDraw(current, playerId, queue, depth),
    });
  }

  private moveByToFinalTile(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    return moveContesByToFinalTile({
      state,
      playerId,
      delta,
      depth,
      appendLog: (current, message) => this.core.appendLog(current, message),
      getMeta: (current) => this.getMeta(current),
      onAnyPlayerPassedBlocked: (current, targetPlayerId, nextPos) =>
        this.onAnyPlayerPassedBlocked(current, targetPlayerId, nextPos),
      appendTileArrivalLog: (current, targetPlayerId, nextPos, tile) =>
        this.appendTileArrivalLog(current, targetPlayerId, nextPos, tile),
      setWinner: (current, targetPlayerId) =>
        this.setWinner(current, targetPlayerId),
      applyTileEffect: (current, targetPlayerId, tile, effectDepth) =>
        this.applyTileEffect(current, targetPlayerId, tile, effectDepth),
    });
  }

  private appendTileArrivalLog(
    state: GameStateEntity,
    playerId: number,
    nextPos: number,
    tile: ContesCacahuetesTile | undefined,
  ): GameStateEntity {
    return appendContesTileArrivalLog({
      state,
      playerId,
      nextPos,
      tile,
      describePlayerPawn: (current, targetPlayerId) =>
        describeContesPlayerPawn(current, this.getMeta(current), targetPlayerId),
      formatArrivalTarget: (label) => formatContesArrivalTarget(label),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private applyBonusEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    return applyContesBonusEffectById({
      state,
      playerId,
      id,
      depth,
      appendLog: (current, message) => this.core.appendLog(current, message),
      addStatusCount: (current, key, targetPlayerId, delta) =>
        this.addStatusCount(current, key, targetPlayerId, delta),
      setStatusBool: (current, key, targetPlayerId, value) =>
        this.setStatusBool(current, key, targetPlayerId, value),
      canUseBonusCards: (current, targetPlayerId) =>
        this.canUseBonusCards(current, targetPlayerId),
      startChooseTarget: (current, targetPlayerId, context, label) =>
        this.targeting.startChooseTarget(current, targetPlayerId, context, label),
      moveBy: (current, targetPlayerId, delta, effectDepth) =>
        this.moveBy(current, targetPlayerId, delta, effectDepth),
      getMeta: (current) => this.getMeta(current),
      rollDice: (meta, faces) => this.random.rollDice(meta, faces),
      applyAbondance: (current, targetPlayerId) =>
        this.applyAbondance(current, targetPlayerId),
      queueDraws: (current, targetPlayerId, queue, effectDepth) =>
        this.queueDraws(current, targetPlayerId, queue, effectDepth),
    });
  }

  private applyMalusEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    return applyContesMalusEffectById({
      state,
      playerId,
      id,
      depth,
      appendLog: (current, message) => this.core.appendLog(current, message),
      addStatusCount: (current, key, targetPlayerId, delta) =>
        this.addStatusCount(current, key, targetPlayerId, delta),
      moveBy: (current, targetPlayerId, delta, effectDepth) =>
        this.moveBy(current, targetPlayerId, delta, effectDepth),
      getMeta: (current) => this.getMeta(current),
      rollDice: (meta, faces) => this.random.rollDice(meta, faces),
      swapWithClosestBehind: (current, targetPlayerId) =>
        this.swapWithClosestBehind(current, targetPlayerId),
      blockUntilPassed: (current, targetPlayerId) =>
        this.blockUntilPassed(current, targetPlayerId),
      drawAndApply: (current, targetPlayerId, type, effectDepth) =>
        this.drawAndApply(current, targetPlayerId, type, effectDepth),
      drawBonusToGive: (current, targetPlayerId) =>
        this.targeting.drawBonusToGive(
          current,
          targetPlayerId,
          (currentState, type) => this.drawCard(currentState, type),
          (currentState, actorId, card) =>
            this.announceDrawnCard(currentState, actorId, card),
        ),
      goToPreviousMalusAndApply: (current, targetPlayerId, effectDepth) =>
        this.goToPreviousMalusAndApply(current, targetPlayerId, effectDepth),
      teleport: (current, targetPlayerId, position) =>
        this.teleport(current, targetPlayerId, position),
    });
  }

  private applySurpriseEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    return applyContesSurpriseEffectById({
      state,
      playerId,
      id,
      depth,
      appendLog: (current, message) => this.core.appendLog(current, message),
      addStatusCount: (current, key, targetPlayerId, delta) =>
        this.addStatusCount(current, key, targetPlayerId, delta),
      setStatusBool: (current, key, targetPlayerId, value) =>
        this.setStatusBool(current, key, targetPlayerId, value),
      moveByToFinalTile: (current, targetPlayerId, delta, effectDepth) =>
        this.moveByToFinalTile(current, targetPlayerId, delta, effectDepth),
      moveBy: (current, targetPlayerId, delta, effectDepth) =>
        this.moveBy(current, targetPlayerId, delta, effectDepth),
      drawAndApply: (current, targetPlayerId, type, effectDepth) =>
        this.drawAndApply(current, targetPlayerId, type, effectDepth),
      applyCoffreMerveilles: (current, targetPlayerId, effectDepth) =>
        this.applyCoffreMerveilles(current, targetPlayerId, effectDepth),
      setPending: (current, pending) => this.setPending(current, pending),
      startChooseTarget: (current, targetPlayerId, context, label) =>
        this.targeting.startChooseTarget(current, targetPlayerId, context, label),
      getMeta: (current) => this.getMeta(current),
      rollDice: (meta, faces) => this.random.rollDice(meta, faces),
    });
  }

  private applyAbondance(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return applyContesAbondance(this.getCardFlowDeps(), state, playerId);
  }

  private applyCoffreMerveilles(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    return applyContesCoffreMerveilles(
      this.getCardFlowDeps(),
      state,
      playerId,
      depth,
    );
  }

  private drawCard(
    state: GameStateEntity,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
  ): { state: GameStateEntity; card: ContesCard | null } {
    return drawContesCard(this.getCardFlowDeps(), state, type);
  }

  private maybeProtectFromMalus(
    state: GameStateEntity,
    playerId: number,
  ): { protected: boolean; state: GameStateEntity } {
    return protectContesPlayerFromMalus(this.getCardFlowDeps(), state, playerId);
  }

  private onAnyPlayerPassedBlocked(
    state: GameStateEntity,
    moverId: number,
    moverPos: number,
  ): GameStateEntity {
    return clearContesBlockedPlayers({
      state,
      moverId,
      moverPos,
      getMeta: (current) => this.getMeta(current),
      setStatusCount: (current, key, playerId, value) =>
        this.setStatusCount(current, key, playerId, value),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private setWinner(state: GameStateEntity, playerId: number): GameStateEntity {
    return setContesWinner({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
    });
  }

  private endTurn(state: GameStateEntity, playerId: number): GameStateEntity {
    return endContesTurn({
      state,
      playerId,
      decrementPerTurn: (current, targetPlayerId, key) =>
        this.decrementPerTurn(current, targetPlayerId, key),
      restoreTurnSwapSlotBeforeAdvance: (current, targetPlayerId) =>
        this.restoreTurnSwapSlotBeforeAdvance(current, targetPlayerId),
      turns: this.turns,
      applyTurnSwapIfNeeded: (current) => this.applyTurnSwapIfNeeded(current),
      appendTurnAnnouncement: (current, targetPlayerId) =>
        this.appendTurnAnnouncement(current, targetPlayerId),
    });
  }

  private finalizePendingResolution(
    previous: GameStateEntity,
    next: GameStateEntity,
  ): GameStateEntity {
    return finalizeContesPendingResolution(this.getCardFlowDeps(), previous, next);
  }

  private applyTurnSwapIfNeeded(state: GameStateEntity): GameStateEntity {
    return applyContesTurnSwapIfNeeded({
      state,
      getMeta: (current) => this.getMeta(current),
      setStatusCount: (current, key, playerId, value) =>
        this.setStatusCount(current, key, playerId, value),
    });
  }

  private restoreTurnSwapSlotBeforeAdvance(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return restoreContesTurnSwapSlotBeforeAdvance({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
      setStatusCount: (current, key, targetPlayerId, value) =>
        this.setStatusCount(current, key, targetPlayerId, value),
    });
  }

  private swapWithClosestBehind(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return swapContesWithClosestBehind({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
      appendLog: (current, message) => this.core.appendLog(current, message),
      swapPositions: (current, aId, bId) =>
        this.targeting.swapPositions(current, aId, bId),
    });
  }

  private blockUntilPassed(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return blockContesUntilPassed({
      state,
      playerId,
      getMeta: (current) => this.getMeta(current),
      setStatusCount: (current, key, targetPlayerId, value) =>
        this.setStatusCount(current, key, targetPlayerId, value),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  private goToPreviousMalusAndApply(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    return goToContesPreviousMalusAndApply({
      state,
      playerId,
      depth,
      getMeta: (current) => this.getMeta(current),
      teleport: (current, targetPlayerId, pos) =>
        this.teleport(current, targetPlayerId, pos),
      appendLog: (current, message) => this.core.appendLog(current, message),
      applyTileEffect: (current, targetPlayerId, tile, effectDepth) =>
        this.applyTileEffect(current, targetPlayerId, tile, effectDepth),
    });
  }

  private teleport(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    return teleportContesPlayer({
      state,
      playerId,
      pos,
      getMeta: (current) => this.getMeta(current),
    });
  }

  private autoSkipIfBlocked(
    state: GameStateEntity,
    currentId: number,
  ): GameStateEntity {
    return autoSkipContesBlockedPlayer({
      state,
      currentId,
      getMeta: (current) => this.getMeta(current),
      appendLog: (current, message) => this.core.appendLog(current, message),
      turns: this.turns,
      applyTurnSwapIfNeeded: (current) => this.applyTurnSwapIfNeeded(current),
      appendTurnAnnouncement: (current, playerId) =>
        this.appendTurnAnnouncement(current, playerId),
    });
  }

  private canUseBonusCards(state: GameStateEntity, playerId: number): boolean {
    const meta = this.getMeta(state);
    const turns = Number(meta.statuses.noBonusCardsTurns?.[playerId] ?? 0);
    return !(Number.isFinite(turns) && turns > 0);
  }

  private decrementPerTurn(
    state: GameStateEntity,
    playerId: number,
    key: keyof ContesCacahuetesMetadata['statuses'],
  ): GameStateEntity {
    return decrementContesStatusPerTurn({
      state,
      playerId,
      key,
      getMeta: (current) => this.getMeta(current),
      getStatusMap: (meta, statusKey) => this.getStatusMap(meta, statusKey),
      setStatusCount: (current, statusKey, targetPlayerId, value) =>
        this.setStatusCount(current, statusKey, targetPlayerId, value),
    });
  }

  private setPending(
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ): GameStateEntity {
    return setContesPendingState(state, pending);
  }

  private setStatusCount(
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ): GameStateEntity {
    return setContesStatusCount({
      state,
      key,
      playerId,
      value,
      getMeta: (current) => this.getMeta(current),
    });
  }

  private setStatusBool(
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ): GameStateEntity {
    return setContesStatusBool({
      state,
      key,
      playerId,
      value,
      getMeta: (current) => this.getMeta(current),
    });
  }

  private addStatusCount(
    state: GameStateEntity,
    key: string,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    return addContesStatusCount({
      state,
      key,
      playerId,
      delta,
      getMeta: (current) => this.getMeta(current),
    });
  }

  private appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
  ): GameStateEntity {
    return this.getTurnPolicies().appendTurnAnnouncement(
      state,
      playerId,
      (s, id) => resolvePlayerNameFromState(s, id),
    );
  }

  private getProgressionDeps(): ContesProgressionDeps {
    return buildContesProgressionDeps({
      random: this.random,
      getMeta: (state) => this.getMeta(state),
      setStatusCount: (state, key, playerId, value) =>
        this.setStatusCount(state, key, playerId, value),
      setStatusBool: (state, key, playerId, value) =>
        this.setStatusBool(state, key, playerId, value),
      setPending: (state, pending) => this.setPending(state, pending),
      appendLog: (state, message) => this.core.appendLog(state, message),
      autoSkipIfBlocked: (state, playerId) =>
        this.autoSkipIfBlocked(state, playerId),
      canUseBonusCards: (state, playerId) =>
        this.canUseBonusCards(state, playerId),
      endTurn: (state, playerId) => this.endTurn(state, playerId),
      onAnyPlayerPassedBlocked: (state, playerId, nextPos) =>
        this.onAnyPlayerPassedBlocked(state, playerId, nextPos),
      appendTileArrivalLog: (state, playerId, nextPos, tile) =>
        this.appendTileArrivalLog(state, playerId, nextPos, tile),
      setWinner: (state, playerId) => this.setWinner(state, playerId),
      moveBy: (state, playerId, delta, depth) =>
        this.moveBy(state, playerId, delta, depth),
      drawAndApply: (state, playerId, type, depth) =>
        this.drawAndApply(state, playerId, type, depth),
      buildConteNarrationFromTile: (tile) =>
        buildContesNarrationFromTile(tile),
      recordConteNarration: (state, playerId, card) =>
        recordContesNarrationState(state, this.getMeta(state), playerId, card),
      maybeProtectFromMalus: (state, playerId) =>
        this.maybeProtectFromMalus(state, playerId),
      startChooseTarget: (state, playerId, context, label) =>
        this.targeting.startChooseTarget(state, playerId, context, label),
    });
  }

  private getCardFlowDeps(): ContesCardFlowDeps {
    return buildContesCardFlowDeps({
      random: this.random,
      deckPolicies: this.deckPolicies,
      getMeta: (state) => this.getMeta(state),
      setPending: (state, pending) => this.setPending(state, pending),
      setStatusBool: (state, key, playerId, value) =>
        this.setStatusBool(state, key, playerId, value),
      setStatusCount: (state, key, playerId, value) =>
        this.setStatusCount(state, key, playerId, value),
      appendLog: (state, message) => this.core.appendLog(state, message),
      queueDraws: (state, playerId, queue, depth, label) =>
        this.queueDraws(state, playerId, queue, depth, label),
      endTurn: (state, playerId) => this.endTurn(state, playerId),
      attachQueuedDrawContinuationFromPending: (state, pending) =>
        this.attachQueuedDrawContinuationFromPending(state, pending),
      resumeQueuedDrawContinuation: (state, pending) =>
        this.resumeQueuedDrawContinuation(state, pending),
      canUseBonusCards: (state, playerId) =>
        this.canUseBonusCards(state, playerId),
    });
  }

  private getChoiceDeps() {
    return buildContesChoiceDeps({
      appendLog: (state: GameStateEntity, message: string) =>
        this.core.appendLog(state, message),
      swapPositions: (state: GameStateEntity, playerId: number, targetPlayerId: number) =>
        this.targeting.swapPositions(state, playerId, targetPlayerId),
      setTurnSwap: (state: GameStateEntity, playerId: number, targetPlayerId: number) =>
        this.targeting.setTurnSwap(state, playerId, targetPlayerId),
      takeOneBonusToken: (
        state: GameStateEntity,
        fromPlayerId: number,
        toPlayerId: number,
      ) => this.targeting.takeOneBonusToken(state, fromPlayerId, toPlayerId),
      startStealTokenChoice: (
        state: GameStateEntity,
        playerId: number,
        targetPlayerId: number,
      ) => this.targeting.startStealTokenChoice(state, playerId, targetPlayerId),
      moveTargetToPlayerAndAdvance: (
        state: GameStateEntity,
        playerId: number,
        targetPlayerId: number,
        delta: number,
      ) =>
        this.targeting.moveTargetToPlayerAndAdvance(
          state,
          playerId,
          targetPlayerId,
          delta,
          (current, currentPlayerId, moveDelta, depth) =>
            this.moveBy(current, currentPlayerId, moveDelta, depth),
        ),
      setPending: (state: GameStateEntity, pending: Exclude<ContesPending, null>) =>
        this.setPending(state, pending),
      startGiveBonusChoice: (
        state: GameStateEntity,
        playerId: number,
        targetPlayerId: number,
      ) => this.targeting.startGiveBonusChoice(state, playerId, targetPlayerId),
      moveBy: (
        state: GameStateEntity,
        playerId: number,
        delta: number,
        depth: number,
      ) => this.moveBy(state, playerId, delta, depth),
      drawAndApply: (
        state: GameStateEntity,
        playerId: number,
        type: 'bonus' | 'malus' | 'surprise' | 'conte',
        depth: number,
      ) => this.drawAndApply(state, playerId, type, depth),
      setStatusBool: (
        state: GameStateEntity,
        key: string,
        playerId: number,
        value: boolean,
      ) => this.setStatusBool(state, key, playerId, value),
      applyBonusEffectById: (
        state: GameStateEntity,
        playerId: number,
        cardId: number,
        depth: number,
      ) => this.applyBonusEffectById(state, playerId, cardId, depth),
      transferBonusToken: (
        state: GameStateEntity,
        fromId: number,
        toId: number,
        cardId: number,
      ) => this.targeting.transferBonusToken(state, fromId, toId, cardId),
      transferSurpriseToken: (
        state: GameStateEntity,
        fromId: number,
        toId: number,
        cardId: number,
      ) => this.targeting.transferSurpriseToken(state, fromId, toId, cardId),
      findCardTitle: (
        state: GameStateEntity,
        cardType: ContesCardType,
        cardId: number,
      ) => this.targeting.findCardTitle(state, cardType, cardId, toContesCardArray),
    });
  }

  private getDrawResolutionDeps() {
    return buildContesDrawResolutionDeps({
      resolveAbondanceDraw: (
        state: GameStateEntity,
        playerId: number,
        data: { remaining?: number; drawn?: ContesCard[]; depth?: number },
      ) => this.resolveAbondanceDraw(state, playerId, data),
      resolveQueuedDraw: (
        state: GameStateEntity,
        playerId: number,
        data: { queue?: string[]; cardType?: string; depth?: number },
      ) => this.resolveQueuedDraw(state, playerId, data),
      maybeProtectFromMalus: (state: GameStateEntity, playerId: number) =>
        this.maybeProtectFromMalus(state, playerId),
      continueQueuedDraw: (
        state: GameStateEntity,
        playerId: number,
        queue: string[],
        depth: number,
      ) => this.continueQueuedDraw(state, playerId, queue, depth),
      drawCard: (
        state: GameStateEntity,
        type: 'bonus' | 'malus' | 'surprise' | 'conte',
      ) => this.drawCard(state, type),
      announceDrawnCard: (
        state: GameStateEntity,
        playerId: number,
        card: ContesCard,
      ) => this.announceDrawnCard(state, playerId, card),
      applyBonusEffectById: (
        state: GameStateEntity,
        playerId: number,
        cardId: number,
        depth: number,
      ) => this.applyBonusEffectById(state, playerId, cardId, depth),
      applyMalusEffectById: (
        state: GameStateEntity,
        playerId: number,
        cardId: number,
        depth: number,
      ) => this.applyMalusEffectById(state, playerId, cardId, depth),
      applySurpriseEffectById: (
        state: GameStateEntity,
        playerId: number,
        cardId: number,
        depth: number,
      ) => this.applySurpriseEffectById(state, playerId, cardId, depth),
      attachQueuedDrawContinuation: (
        state: GameStateEntity,
        queue: string[],
        depth: number,
        playerId: number,
      ) => this.attachQueuedDrawContinuation(state, queue, depth, playerId),
      setPending: (state: GameStateEntity, pending: Exclude<ContesPending, null>) =>
        this.setPending(state, pending),
    });
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }

  private getMeta(state: GameStateEntity): ContesCacahuetesMetadata {
    return (state.metadata ?? {}) as ContesCacahuetesMetadata;
  }

  private getStatusMap(
    meta: ContesCacahuetesMetadata,
    key: keyof ContesCacahuetesMetadata['statuses'],
  ): Record<number, unknown> {
    return getContesStatusMap(meta, key);
  }
}




