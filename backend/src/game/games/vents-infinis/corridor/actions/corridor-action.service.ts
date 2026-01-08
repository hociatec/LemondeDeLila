import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';

@Injectable()
export class CorridorActionService {
  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const actorId = state.turn?.currentPlayerId ?? null;
    const type = String(action?.type ?? '').trim().toLowerCase();
    if (type === 'corridor_move') {
      return this.applyMove(state, action, actorId);
    }
    if (type === 'corridor_place_wall') {
      return this.applyWall(state, action, actorId);
    }

    return state;
  }

  private applyMove(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const { to, actorId: validatedActor } = CorridorRulebook.validateMoveAction(
      state,
      action,
      actorId,
    );

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const from = CorridorRulebook.getPawnPos(meta, validatedActor);

    const nextMeta: CorridorMetadata = {
      ...meta,
      pawnsByPlayerId: {
        ...(meta.pawnsByPlayerId ?? {}),
        [String(validatedActor)]: { x: to.x, y: to.y },
      },
    };

    return this.advanceTurnAndMaybeFinish(state, validatedActor, nextMeta, {
      moveMessage: `(${from.x + 1},${from.y + 1}) → (${to.x + 1},${to.y + 1})`,
      maybeWinnerPos: to,
    });
  }

  private applyWall(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const { wall, actorId: validatedActor } =
      CorridorRulebook.validatePlaceWallAction(state, action, actorId);

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const remaining = (meta?.wallsRemainingByPlayerId ?? {})[
      String(validatedActor)
    ] ?? 0;

    const nextMeta: CorridorMetadata = {
      ...CorridorRulebook.applyWall(meta, wall),
      wallsRemainingByPlayerId: {
        ...(meta?.wallsRemainingByPlayerId ?? {}),
        [String(validatedActor)]: Math.max(0, remaining - 1),
      },
    };

    const label =
      wall.o === 'h'
        ? `mur horizontal (${wall.x + 1},${wall.y + 1})`
        : `mur vertical (${wall.x + 1},${wall.y + 1})`;

    return this.advanceTurnAndMaybeFinish(state, validatedActor, nextMeta, {
      moveMessage: label,
      maybeWinnerPos: null,
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
    }

    const actorName = actor?.username ?? `#${actorId}`;
    const moveMsg = `${actorName} : ${options.moveMessage}.`;
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
        ? { ...(state.turn ?? { currentPlayerId: null, direction: 1 }), currentPlayerId: null }
        : {
            ...(state.turn ?? { currentPlayerId: nextPlayerId, direction: 1 }),
            currentPlayerId: nextPlayerId,
            label: `Tour de ${other?.username ?? 'joueur'}`,
          },
    };
  }
}

