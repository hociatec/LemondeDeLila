import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';

import {
  applyActionPipeline,
  applyActionsSequentially,
  dispatchByActionType,
  harmonizeActionStateReturn,
  normalizeLowerActionType,
} from '../../../../actions/action-service.helper';
@Injectable()
export class CorridorActionService {
  private toCellRef(pos: { x: number; y: number }, size: number): string {
    const col = CorridorActionService.toColumnLetters((pos?.x ?? 0) + 1);
    const row = Math.max(1, size - (pos?.y ?? 0));
    return `${col}${row}`.toLowerCase();
  }

  private static toColumnLetters(column: number): string {
    let n = Math.max(1, Math.floor(Number(column) || 1));
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return out;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(
      harmonizeActionStateReturn(state),
      actions,
      (next, action) => this.applyOne(harmonizeActionStateReturn(next), action),
    );
  }

  private applyOne(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const actorId = state.turn?.currentPlayerId ?? null;
    const type = normalizeLowerActionType(action);
    return dispatchByActionType(
      type,
      {
        corridor_move: () => this.applyMove(state, action, actorId),
        corridor_place_wall: () => this.applyWall(state, action, actorId),
      },
      () => state,
    );
  }

  private applyMove(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return applyActionPipeline(state, action, {
      guard: () => actorId != null,
      validate: (current, currentAction) =>
        CorridorRulebook.validateMoveAction(current, currentAction, actorId),
      transition: (current, _currentAction, validatedMove) => {
        const { to, actorId: validatedActor } = validatedMove;
        const meta = (current.metadata ?? {}) as CorridorMetadata;
        const from = CorridorRulebook.getPawnPos(meta, validatedActor);
        const size = Number(meta?.size ?? 0) || 9;

        const nextMeta: CorridorMetadata = {
          ...meta,
          pawnsByPlayerId: {
            ...(meta.pawnsByPlayerId ?? {}),
            [String(validatedActor)]: { x: to.x, y: to.y },
          },
        };

        return {
          actorId: validatedActor,
          metadata: nextMeta,
          moveMessage: `se déplace de ${this.toCellRef(from, size)} à ${this.toCellRef(to, size)}`,
          maybeWinnerPos: to,
        };
      },
      effects: (current, _currentAction, _validatedMove, transitioned) =>
        this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
          moveMessage: transitioned.moveMessage,
          maybeWinnerPos: transitioned.maybeWinnerPos,
        }),
    });
  }

  private applyWall(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return applyActionPipeline(state, action, {
      guard: () => actorId != null,
      validate: (current, currentAction) =>
        CorridorRulebook.validatePlaceWallAction(current, currentAction, actorId),
      transition: (current, _currentAction, validatedWall) => {
        const { wall, actorId: validatedActor } = validatedWall;
        const meta = (current.metadata ?? {}) as CorridorMetadata;
        const size = Number(meta?.size ?? 0) || 9;
        const remaining =
          (meta?.wallsRemainingByPlayerId ?? {})[String(validatedActor)] ?? 0;

        const nextMeta: CorridorMetadata = {
          ...CorridorRulebook.applyWall(meta, wall),
          wallsRemainingByPlayerId: {
            ...(meta?.wallsRemainingByPlayerId ?? {}),
            [String(validatedActor)]: Math.max(0, remaining - 1),
          },
        };

        const at = this.toCellRef({ x: wall.x, y: wall.y }, size);
        const orientation = wall.o === 'h' ? 'horizontal' : 'vertical';

        return {
          actorId: validatedActor,
          metadata: nextMeta,
          moveMessage: `place un mur ${orientation} en ${at}`,
          maybeWinnerPos: null,
        };
      },
      effects: (current, _currentAction, _validatedWall, transitioned) =>
        this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
          moveMessage: transitioned.moveMessage,
          maybeWinnerPos: transitioned.maybeWinnerPos,
        }),
    });
  }

  private advanceTurnAndMaybeFinish(
    state: GameStateEntity,
    actorId: number,
    nextMeta: CorridorMetadata,
    options: { moveMessage: string; maybeWinnerPos: any },
  ): GameStateEntity {
    const players = state.players ?? [];
    const actor = players.find((p) => p?.id === actorId);
    const other = players.find((p) => p?.id !== actorId);
    const nextPlayerId = other?.id ?? actorId;

    const won =
      options.maybeWinnerPos != null
        ? CorridorRulebook.isWinningPos(state, actorId, options.maybeWinnerPos)
        : false;

    const status = won ? 'finished' : state.status;
    if (won) {
      nextMeta.winnerPlayerId = actorId;
      (nextMeta as any).winnerId = actorId;
    }

    const actorName = actor?.username ?? `#${actorId}`;
    const moveMsg = `${actorName} ${options.moveMessage}.`;
    const winMsg = won ? `Victoire de ${actorName}.` : null;

    return {
      ...state,
      status,
      metadata: nextMeta as any,
      turnIndex: (state.turnIndex ?? 0) + 1,
      log: [
        ...(state.log ?? []),
        { message: moveMsg },
        ...(winMsg ? [{ message: winMsg }] : []),
      ],
      turn: won
        ? {
            ...(state.turn ?? { currentPlayerId: null, direction: 1 }),
            currentPlayerId: null,
          }
        : {
            ...(state.turn ?? { currentPlayerId: nextPlayerId, direction: 1 }),
            currentPlayerId: nextPlayerId,
            label: `Tour de ${other?.username ?? 'joueur'}`,
          },
    };
  }
}
