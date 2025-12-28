import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as JeuOieRulebook from '../rulebook/rulebook';
import { JEU_OIE_GAME } from '../definitions/game.definition';
import type { JeuOieMetadata } from '../model/jeu-oie-state.entity';

@Injectable()
export class JeuOiePresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const actions = JeuOieRulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as JeuOieMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
      currentPlayerView: { id: userId, username: me?.username ?? `Joueur ${userId}` },
      shortcuts: [{ key: 'pressed P', type: 'interface', id: 'position' }],
    };

    return {
      ...state,
      catalog: { phases: JEU_OIE_GAME.phaseOrder.map((p) => p.id), victory: null },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: state.pending ?? null,
      extras,
      board: {
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
        laps: meta.laps ?? {},
      },
    } as any;
  }
}

