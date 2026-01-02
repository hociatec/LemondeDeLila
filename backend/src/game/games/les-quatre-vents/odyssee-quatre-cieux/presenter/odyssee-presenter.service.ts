import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { ODYSSEE_GAME } from '../definitions/odyssee.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { OdysseeMetadata } from '../model/odyssee.types';
import { buildOdysseeShortcuts } from '../odyssee.shortcuts';

@Injectable()
export class OdysseePresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as OdysseeMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    return {
      ...state,
      catalog: { phases: ODYSSEE_GAME.phaseOrder.map((p) => p.id), victory: null },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
        shortcuts: buildOdysseeShortcuts({
          metadata: meta as any,
          currentPlayerId: userId,
          started: true,
        }),
      },
      board: {
        trackLength: meta.trackLength,
        homeLength: meta.homeLength,
        offsets: meta.offsets ?? {},
        pawnsByPlayer: meta.pawnsByPlayer ?? {},
      },
    } as any;
  }
}
