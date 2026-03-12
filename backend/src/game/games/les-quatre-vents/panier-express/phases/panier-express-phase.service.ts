import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { ActionLogService } from '../../../../modules/actionlog/services/action-log.service';
import { playingLog } from '../../../../../common/utils/playing-logger';
import { PANIER_EXPRESS_PHASES } from '../definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from '../definitions/victory.definition';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';

@Injectable()
export class PanierExpressPhaseService {
  private readonly phaseOrder = PANIER_EXPRESS_PHASES;

  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly victory: VictoryService,
    private readonly actionLogSvc: ActionLogService,
    private readonly utils: PanierExpressUtils,
  ) {}

  advancePhases(state: GameStateEntity): GameStateEntity {
    let next = state;
    for (const phase of this.phaseOrder) {
      if (phase.id === 'check_victory') {
        next = this.applyVictory(next);
      } else if (phase.onEnter) {
        next = phase.onEnter(next);
      }
      if ((next.status || '').toLowerCase() === 'finished') break;
    }
    return next;
  }

  advanceTurn(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? (state.players ?? []).findIndex((p) => p.id === currentId)
        : state.turnIndex;
    const next = this.turns.advanceTurn(state, { skipAnnouncement: true });

    const meta = this.getMetadata(next);
    const statuses: any = meta.statuses ?? {};
    const turnFlow: any =
      meta && typeof meta === 'object' ? (meta as any).turnFlow : null;

    const decrementMap = (input: Record<number, number> | undefined) => {
      const out: Record<number, number> = {};
      Object.entries(input ?? {}).forEach(([pid, val]) => {
        const nextVal = Math.max(0, Number(val) - 1);
        if (nextVal > 0) out[Number(pid)] = nextVal;
      });
      return out;
    };

    const revealInventory = decrementMap(statuses.revealInventory);
    const revealShoppingList = decrementMap(statuses.revealShoppingList);
    const noDrawCourses = decrementMap(statuses.noDrawCourses);

    let movementDirection: 1 | -1 = meta.movementDirection === -1 ? -1 : 1;
    let movementDirectionOwnerId =
      typeof meta.movementDirectionOwnerId === 'number'
        ? meta.movementDirectionOwnerId
        : null;
    if (
      movementDirection === -1 &&
      movementDirectionOwnerId != null &&
      (next.turn?.currentPlayerId ?? null) === movementDirectionOwnerId
    ) {
      movementDirection = 1;
      movementDirectionOwnerId = null;
    }

    const withMeta: GameStateEntity = {
      ...next,
      metadata: {
        ...(next.metadata as any),
        movementDirection,
        movementDirectionOwnerId,
        statuses: {
          ...statuses,
          revealInventory,
          revealShoppingList,
          noDrawCourses,
        },
      },
      turn: {
        ...(next.turn ?? { currentPlayerId: null, direction: 1 }),
        direction: movementDirection,
      },
    };
    playingLog('panier.advanceTurn', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: currentId,
      type: 'advance_turn',
      currentId,
      currentIndex,
      nextTurnIndex: withMeta.turnIndex,
      nextCurrentPlayerId: withMeta.turn?.currentPlayerId ?? null,
      skipTurn: (withMeta.metadata as any)?.statuses?.skipTurn ?? {},
    });
    const skipped = Array.isArray(turnFlow?.skipped) ? turnFlow.skipped : [];
    let out = withMeta;
    for (const entry of skipped) {
      const id = typeof entry?.id === 'number' ? entry.id : null;
      if (id == null) continue;
      const remaining =
        typeof entry?.remainingAfter === 'number' ? entry.remainingAfter : 0;
      const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
      out = this.core.appendLog(
        out,
        `[Panier Express] ${this.utils.playerName(out, id)} passe son tour${suffix}.`,
      );
    }

    const cleanedTurnFlow = {
      ...(turnFlow && typeof turnFlow === 'object' ? turnFlow : {}),
      skipped: [],
    };
    const cleaned: GameStateEntity = {
      ...out,
      metadata: {
        ...(out.metadata as any),
        turnFlow: cleanedTurnFlow,
      },
    };
    const nextPlayerId = cleaned.turn?.currentPlayerId ?? null;
    if (typeof nextPlayerId !== 'number' || !Number.isFinite(nextPlayerId)) {
      return cleaned;
    }
    return this.core.appendLog(
      cleaned,
      `C'est au tour de ${this.utils.playerName(cleaned, nextPlayerId)}.`,
    );
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const meta = this.getMetadata(state);
    const result = this.victory.evaluate(state, PANIER_EXPRESS_VICTORY);
    if (!result || !result.finished) return state;
    const winnerId =
      typeof result.winnerId === 'number' ? result.winnerId : meta.winnerId;
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      winnerId: winnerId ?? null,
    };
    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
    };
    const winnerName =
      winnerId != null
        ? this.utils.playerName(state, winnerId)
        : 'Partie terminée';
    const logged = this.core.appendLog(
      nextState,
      `[Panier Express] ${winnerName} remporte la partie !`,
    );
    return this.appendActionLog(logged, winnerId ?? null, 'victory', {
      conditionId: result.conditionId,
    });
  }

  private appendActionLog(
    state: GameStateEntity,
    actorId: number | null,
    type: string,
    payload?: Record<string, unknown>,
  ): GameStateEntity {
    const meta = this.getMetadata(state);
    const actionLog = this.actionLogSvc.append(meta.actionLog, {
      actorId,
      type,
      payload,
    });
    return { ...state, metadata: { ...meta, actionLog } };
  }

  private getMetadata(state: GameStateEntity): PanierExpressMetadata {
    return state.metadata as PanierExpressMetadata;
  }
}
