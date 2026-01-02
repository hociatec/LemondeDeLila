import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import { A_FOND_LES_BALLONS_GAME } from '../definitions/game.definition';
import type { AFondLesBallonsMetadata } from '../model/a-fond-les-ballons-state.entity';
import { buildAFondLesBallonsShortcuts } from '../a-fond-les-ballons.shortcuts';

@Injectable()
export class AFondLesBallonsPresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as AFondLesBallonsMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
      currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
      shortcuts: buildAFondLesBallonsShortcuts({
        metadata: meta as any,
        currentPlayerId: userId,
        started: true,
      }),
    };

    return {
      ...state,
      catalog: { phases: A_FOND_LES_BALLONS_GAME.phaseOrder.map((p) => p.id), victory: null },
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

