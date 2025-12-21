import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
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
    private readonly turns: TurnService,
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
    const players = state.players ?? [];
    if (players.length === 0) return state;
    const meta = this.getMetadata(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p) => p.id === currentId)
        : state.turnIndex;
    const next = this.turns.nextTurn(
      players,
      currentIndex >= 0 ? currentIndex : state.turnIndex,
      meta.statuses.skipTurn,
    );
    playingLog('panier.advanceTurn', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: currentId,
      type: 'advance_turn',
      currentId,
      currentIndex,
      nextTurnIndex: next.turnIndex,
      nextCurrentPlayerId: next.currentPlayerId,
      skipTurn: next.skipTurn,
    });
    const nextMeta: PanierExpressMetadata = {
      ...meta,
      statuses: { ...meta.statuses, skipTurn: next.skipTurn },
    };
    return {
      ...state,
      metadata: nextMeta,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: 1,
      },
    };
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
