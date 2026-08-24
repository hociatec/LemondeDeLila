import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import * as JeuOieRulebook from '../../rulebook/rulebook';
import { JEU_OIE_GAME } from '../../definitions/game.definition';
import type {
  JeuOieMetadata,
  JeuOieTile,
} from '../../model/jeu-oie-state.model';

type PresenterExtras = Record<string, unknown>;

export class JeuOiePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = JeuOieRulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as JeuOieMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...((state as { extras?: PresenterExtras }).extras ?? {}),
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      ui: {
        panels: {
          board: {
            title: 'Plateau',
            message: this.buildBoardMessage(meta),
          },
        },
      },
    };

    return {
      ...state,
      catalog: {
        phases: JEU_OIE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
        meta.laps,
      ),
    };
  }

  private buildBoardMessage(meta: JeuOieMetadata): string {
    const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
    if (tiles.length === 0) {
      return 'Plateau: indisponible.';
    }

    const startIndex = tiles.findIndex((t: JeuOieTile) => t?.type === 'start');
    const finishIndex = tiles.findIndex(
      (t: JeuOieTile) => t?.type === 'finish',
    );
    const from = startIndex >= 0 ? startIndex : 0;
    const to = finishIndex >= 0 ? finishIndex : tiles.length - 1;

    const lines: string[] = [];
    for (let i = from; i <= to; i += 1) {
      const t = tiles[i] as JeuOieTile | undefined;
      const label = String(t?.label ?? '').trim() || `Case ${i}`;
      lines.push(`${i}: ${label}.`);
    }
    return lines.join('\n');
  }
}




