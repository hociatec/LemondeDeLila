import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { TurnFlowService } from '../../../../../modules/turn/services/turn-flow.service';
import { ActionLogService } from '../../../../../modules/actionlog/services/action-log.service';
import { playingLog } from '../../../../../../common/utils/playing-logger';
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
    const next = this.turns.advanceTurn(state);
    playingLog('panier.advanceTurn', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: currentId,
      type: 'advance_turn',
      currentId,
      currentIndex,
      nextTurnIndex: next.turnIndex,
      nextCurrentPlayerId: next.turn?.currentPlayerId ?? null,
      skipTurn: (next.metadata as any)?.statuses?.skipTurn ?? {},
    });
    return next;
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
