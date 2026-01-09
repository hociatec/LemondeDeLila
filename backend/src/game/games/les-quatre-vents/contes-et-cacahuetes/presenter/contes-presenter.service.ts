import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as Rulebook from '../rulebook/rulebook';
import { CONTES_CACAHUETES_GAME } from '../definitions/game.definition';
import type { ContesCacahuetesMetadata } from '../model/contes-et-cacahuetes-state.entity';
import { buildContesShortcuts } from '../contes.shortcuts';

@Injectable()
export class ContesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as ContesCacahuetesMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      shortcuts: buildContesShortcuts({
        metadata: meta as any,
        currentPlayerId: userId,
        started: true,
      }),
    };

    return {
      ...state,
      catalog: {
        phases: CONTES_CACAHUETES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
    } as any;
  }
}
