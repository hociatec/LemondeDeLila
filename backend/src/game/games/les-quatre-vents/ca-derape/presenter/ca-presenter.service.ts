import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { CA_DERAPE_GAME } from '../definitions/ca.definition';
import * as Rulebook from '../rulebook/ca.rulebook';
import type { CaMetadata } from '../model/ca.types';
import { buildCaDerapeShortcuts } from '../ca-derape.shortcuts';

@Injectable()
export class CaPresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as CaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    return {
      ...state,
      catalog: { phases: CA_DERAPE_GAME.phaseOrder.map((p) => p.id), victory: null },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
        shortcuts: buildCaDerapeShortcuts({
          metadata: meta as any,
          currentPlayerId: userId,
          started: true,
        }),
      },
      board: {
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
      },
    } as any;
  }
}

