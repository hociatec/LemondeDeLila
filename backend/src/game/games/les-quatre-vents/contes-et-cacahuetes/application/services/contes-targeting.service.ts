import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import {
  drawContesBonusToGive,
  findContesCardTitle,
  startContesChooseTarget,
} from '../../actions/contes-targeting.helper';
import {
  listContesBonusTokens,
  listContesSurpriseTokens,
  startContesStealTokenChoice,
  takeOneContesBonusToken,
  transferContesBonusToken,
  transferContesSurpriseToken,
} from '../../actions/contes-token-actions.helper';
import {
  moveContesTargetToPlayerAndAdvance,
  setContesTurnSwap,
  swapContesPositions,
} from '../../actions/contes-position-actions.helper';
import {
  addContesStatusCount,
  setContesPendingState,
  setContesStatusBool,
  setContesStatusCount,
} from '../../actions/contes-status-state.helper';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesPending,
} from '../../model/contes-et-cacahuetes-state.model';

type ContesStatusKey = keyof ContesCacahuetesMetadata['statuses'];

export class ContesTargetingService {
  constructor(private readonly core: GameCoreService) {}

  startChooseTarget(
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ): GameStateEntity {
    return startContesChooseTarget({
      state,
      playerId,
      context,
      label,
      getMeta: (current) => this.getMeta(current),
      listBonusTokens: (meta, targetPlayerId) =>
        this.listBonusTokens(meta, targetPlayerId),
      listSurpriseTokens: (meta, targetPlayerId) =>
        this.listSurpriseTokens(meta, targetPlayerId),
      appendLog: (current, message) => this.core.appendLog(current, message),
      setPending: (current, pending) => this.setPending(current, pending),
    });
  }

  drawBonusToGive(
    state: GameStateEntity,
    playerId: number,
    drawCard: (
      current: GameStateEntity,
      type: 'bonus' | 'malus' | 'surprise' | 'conte',
    ) => { state: GameStateEntity; card: ContesCard | null },
    announceDrawnCard: (
      current: GameStateEntity,
      playerId: number,
      card: ContesCard,
    ) => GameStateEntity,
  ): GameStateEntity {
    return drawContesBonusToGive({
      state,
      playerId,
      drawCard: (current, type) => drawCard(current, type),
      appendLog: (current, message) => this.core.appendLog(current, message),
      announceDrawnCard: (current, targetPlayerId, card) =>
        announceDrawnCard(current, targetPlayerId, card),
      startChooseTarget: (current, targetPlayerId, nextContext, nextLabel) =>
        this.startChooseTarget(current, targetPlayerId, nextContext, nextLabel),
    });
  }

  startGiveBonusChoice(
    state: GameStateEntity,
    giverId: number,
    targetId: number,
  ): GameStateEntity {
    const tokens = this.listBonusTokens(this.getMeta(state), giverId);
    if (!tokens.length) {
      return this.core.appendLog(
        state,
        `${resolvePlayerNameFromState(state, giverId)} n'a aucune carte Bonus à donner.`,
      );
    }
    return this.setPending(state, {
      type: 'choose_card',
      label: `Choisissez la carte Bonus à donner à ${resolvePlayerNameFromState(state, targetId)}, puis Entrée.`,
      playerId: giverId,
      blocking: true,
      choices: tokens.map((t) => t.title),
      data: {
        context: `give_bonus_to:${targetId}`,
        cards: tokens.map((t) => ({
          cardType: 'bonus',
          cardId: t.cardId,
          title: t.title,
        })),
      },
    });
  }

  listBonusTokens(
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ): Array<{ cardId: number; title: string }> {
    return listContesBonusTokens(meta, playerId);
  }

  listSurpriseTokens(
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ): Array<{ cardId: number; title: string }> {
    return listContesSurpriseTokens(meta, playerId);
  }

  startStealTokenChoice(
    state: GameStateEntity,
    thiefId: number,
    fromId: number,
  ): GameStateEntity {
    return startContesStealTokenChoice({
      state,
      thiefId,
      fromId,
      getMeta: (current) => this.getMeta(current),
      listBonusTokens: (meta, playerId) => this.listBonusTokens(meta, playerId),
      listSurpriseTokens: (meta, playerId) =>
        this.listSurpriseTokens(meta, playerId),
      appendLog: (current, message) => this.core.appendLog(current, message),
      setPending: (current, pending) => this.setPending(current, pending),
      transferBonusToken: (current, currentFromId, currentToId, bonusId) =>
        this.transferBonusToken(current, currentFromId, currentToId, bonusId),
      transferSurpriseToken: (current, currentFromId, currentToId, surpriseId) =>
        this.transferSurpriseToken(current, currentFromId, currentToId, surpriseId),
    });
  }

  transferBonusToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    bonusId: number,
  ): GameStateEntity {
    return transferContesBonusToken({
      state,
      fromId,
      toId,
      bonusId,
      getMeta: (current) => this.getMeta(current),
      setStatusCount: (current, key, playerId, value) =>
        this.setStatusCount(current, key, playerId, value),
      addStatusCount: (current, key, playerId, delta) =>
        this.addStatusCount(current, key, playerId, delta),
      setStatusBool: (current, key, playerId, value) =>
        this.setStatusBool(current, key, playerId, value),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  transferSurpriseToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    surpriseId: number,
  ): GameStateEntity {
    return transferContesSurpriseToken({
      state,
      fromId,
      toId,
      surpriseId,
      getMeta: (current) => this.getMeta(current),
      setStatusBool: (current, key, playerId, value) =>
        this.setStatusBool(current, key, playerId, value),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  takeOneBonusToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
  ): GameStateEntity {
    return takeOneContesBonusToken({
      state,
      fromId,
      toId,
      getMeta: (current) => this.getMeta(current),
      listBonusTokens: (meta, playerId) => this.listBonusTokens(meta, playerId),
      appendLog: (current, message) => this.core.appendLog(current, message),
      transferBonusToken: (current, currentFromId, currentToId, bonusId) =>
        this.transferBonusToken(current, currentFromId, currentToId, bonusId),
    });
  }

  swapPositions(
    state: GameStateEntity,
    aId: number,
    bId: number,
  ): GameStateEntity {
    return swapContesPositions({
      state,
      aId,
      bId,
      getMeta: (current) => this.getMeta(current),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  moveTargetToPlayerAndAdvance(
    state: GameStateEntity,
    ownerId: number,
    targetId: number,
    deltaAfterMove: number,
    moveBy: (
      current: GameStateEntity,
      playerId: number,
      delta: number,
      depth: number,
    ) => GameStateEntity,
  ): GameStateEntity {
    return moveContesTargetToPlayerAndAdvance({
      state,
      ownerId,
      targetId,
      deltaAfterMove,
      getMeta: (current) => this.getMeta(current),
      appendLog: (current, message) => this.core.appendLog(current, message),
      moveBy: (current, playerId, delta, depth) =>
        moveBy(current, playerId, delta, depth),
    });
  }

  setTurnSwap(
    state: GameStateEntity,
    aId: number,
    bId: number,
  ): GameStateEntity {
    return setContesTurnSwap({
      state,
      aId,
      bId,
      setStatusCount: (current, key, playerId, value) =>
        this.setStatusCount(current, key, playerId, value),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  findCardTitle(
    state: GameStateEntity,
    type: ContesCardType,
    cardId: number,
    toContesCardArray: (value: unknown) => ContesCard[],
  ): string | null {
    return findContesCardTitle({
      state,
      type,
      cardId,
      getMeta: (current) => this.getMeta(current),
      toContesCardArray,
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
    key: ContesStatusKey,
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
    key: ContesStatusKey,
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
    key: ContesStatusKey,
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

  private getMeta(state: GameStateEntity): ContesCacahuetesMetadata {
    return (state.metadata ?? {}) as ContesCacahuetesMetadata;
  }
}




