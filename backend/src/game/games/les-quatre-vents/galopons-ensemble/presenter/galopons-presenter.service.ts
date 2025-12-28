import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { GALOPONS_GAME } from '../definitions/galopons.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { GaloponsMetadata } from '../model/galopons.types';

@Injectable()
export class GaloponsPresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as GaloponsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    return {
      ...state,
      catalog: { phases: GALOPONS_GAME.phaseOrder.map((p) => p.id), victory: null },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
        shortcuts: [{ key: 'pressed P', type: 'interface', id: 'position' }],
        apples: meta.apples ?? {},
      },
      board: {
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
      },
    } as any;
  }
}
