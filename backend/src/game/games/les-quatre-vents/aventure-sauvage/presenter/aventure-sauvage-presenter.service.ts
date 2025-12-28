import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { AVENTURE_SAUVAGE_GAME } from '../definitions/game.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { AventureSauvageMetadata } from '../model/aventure-sauvage-state.entity';

@Injectable()
export class AventureSauvagePresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as AventureSauvageMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
      currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
      shortcuts: [{ key: 'pressed P', type: 'interface', id: 'position' }],
    };

    return {
      ...state,
      catalog: { phases: AVENTURE_SAUVAGE_GAME.phaseOrder.map((p) => p.id), victory: null },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: state.pending ?? null,
      extras,
      board: {
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
        laps: {},
      },
    } as any;
  }
}

