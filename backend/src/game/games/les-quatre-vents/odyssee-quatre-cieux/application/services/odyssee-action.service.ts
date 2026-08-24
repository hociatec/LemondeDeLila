import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import type { OdysseeMetadata } from '../../model/odyssee.types';
import {
  asOdysseePartialMeta,
  asOdysseeRecord,
  describeOdysseePawnLabel,
  describeOdysseePlayerName,
  resolveOdysseeWinnerId,
} from './odyssee-action.utils';

type PendingMove = { pawnIndex: number; targetProgress: number; label: string };

export class OdysseeActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
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
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
          ROLL_DICE: () => {
            next = this.handleRoll(next);
            return next;
          },
          roll_dice: () => {
            next = this.handleRoll(next);
            return next;
          },
          move_pawn: () => {
            next = this.handleMovePawn(next, action);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    meta = { ...meta, ...asOdysseePartialMeta(rng.meta) };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
      lastRoll: roll,
    };
    next = this.core.appendLog(
      next,
      `${describeOdysseePlayerName(next, currentId)} lance le dÃƒÆ’Ã‚Â© : "${roll}".`,
    );

    const moves = this.computeMoves(next, currentId, roll);
    if (moves.length === 0) {
      next = this.core.appendLog(
        next,
        `${describeOdysseePlayerName(next, currentId)} ne peut jouer aucun pion.`,
      );
      return this.endTurn(next, false);
    }

    if (moves.length === 1) {
      next = this.applyMove(next, currentId, moves[0]);
      if (this.getMeta(next).winnerId) return next;
      return this.endTurn(next, roll === 6);
    }

    const pending: PendingState = {
      type: 'choose_pawn',
      playerId: currentId,
      blocking: true,
      choices: moves.map((m) => m.label),
      data: {
        roll,
        moves: moves.map((m) => ({
          pawnIndex: m.pawnIndex,
          targetProgress: m.targetProgress,
          label: m.label,
        })),
      },
    };
    return { ...next, pending };
  }

  private handleMovePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = asOdysseeRecord(state.pending);
    if (String(pending.type ?? '') !== 'choose_pawn') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null || Number(pending.playerId ?? NaN) !== currentId) {
      return state;
    }

    const payload = asOdysseeRecord(action.payload);
    const pawnIndex = Number(payload.pawnIndex ?? NaN);
    const moves = Array.isArray(asOdysseeRecord(pending.data).moves)
      ? (asOdysseeRecord(pending.data).moves as PendingMove[])
      : [];
    const selected = moves.find((move) => Number(move.pawnIndex) === pawnIndex);
    if (!selected) return state;

    let next = this.applyMove({ ...state, pending: null }, currentId, selected);
    if (this.getMeta(next).winnerId) return next;
    const roll = Number(asOdysseeRecord(pending.data).roll ?? 0);
    return this.endTurn(next, roll === 6);
  }

  private applyMove(
    state: GameStateEntity,
    playerId: number,
    move: PendingMove,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pawnsByPlayer = { ...(meta.pawnsByPlayer ?? {}) };
    const pawns = Array.isArray(pawnsByPlayer[playerId])
      ? [...pawnsByPlayer[playerId]]
      : [];
    const idx = pawns.findIndex((pawn) => Number(pawn?.pawnIndex) === move.pawnIndex);
    if (idx < 0) return state;
    pawns[idx] = { ...pawns[idx], progress: move.targetProgress };
    pawnsByPlayer[playerId] = pawns;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, pawnsByPlayer },
    };
    next = this.core.appendLog(
      next,
      `${describeOdysseePlayerName(next, playerId)} avance ${describeOdysseePawnLabel(move.pawnIndex)}.`,
    );

    const winnerId = this.resolveWinnerId(next, playerId);
    if (winnerId != null) {
      next = this.core.appendLog(
        next,
        `${describeOdysseePlayerName(next, winnerId)} remporte la partie !`,
      );
      return {
        ...next,
        status: 'finished',
        metadata: { ...(next.metadata ?? {}), ...(this.getMeta(next)), winnerId },
      };
    }
    return next;
  }

  private computeMoves(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): PendingMove[] {
    const meta = this.getMeta(state);
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    const trackLength = Number(meta.trackLength ?? 56);
    const homeLength = Number(meta.homeLength ?? 6);
    const arrivalProgress = trackLength + homeLength - 1;
    return pawns
      .map((pawn) => {
        const current = Number(pawn?.progress ?? -1);
        let target = current;
        if (current < 0) {
          if (roll !== 6) return null;
          target = 0;
        } else {
          target = current + roll;
        }
        if (target > arrivalProgress) return null;
        return {
          pawnIndex: Number(pawn?.pawnIndex ?? -1),
          targetProgress: target,
          label: `${describeOdysseePawnLabel(Number(pawn?.pawnIndex ?? -1))} -> ${target}`,
        } satisfies PendingMove;
      })
      .filter((entry): entry is PendingMove => entry != null && entry.pawnIndex >= 0);
  }

  private endTurn(state: GameStateEntity, replay: boolean): GameStateEntity {
    if (replay) {
      return this.core.appendLog(state, `Le joueur rejoue.`);
    }
    return this.turns.advanceTurn({ ...state, pending: null });
  }

  private resolveWinnerId(
    state: GameStateEntity,
    playerId: number,
  ): number | null {
    return resolveOdysseeWinnerId(this.getMeta(state), playerId);
  }

  private getMeta(state: GameStateEntity): OdysseeMetadata {
    return (state.metadata ?? {}) as OdysseeMetadata;
  }
}
