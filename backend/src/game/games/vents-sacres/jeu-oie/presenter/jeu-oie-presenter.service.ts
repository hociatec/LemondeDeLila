import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as JeuOieRulebook from '../rulebook/rulebook';
import { JEU_OIE_GAME } from '../definitions/game.definition';
import type { JeuOieMetadata } from '../model/jeu-oie-state.entity';

@Injectable()
export class JeuOiePresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = JeuOieRulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as JeuOieMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const extras = {
      ...(state as any).extras,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      ui: {
        panels: {
          position: {
            title: 'Position',
            message: this.buildPositionMessage(meta, userId),
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
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
        meta.laps,
      ),
    } as any;
  }

  private buildPositionMessage(meta: JeuOieMetadata, userId: number): string {
    const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
    const posRaw = (meta?.positions as any)?.[userId];
    const pos = typeof posRaw === 'number' ? posRaw : Number(posRaw);
    if (!Number.isFinite(pos) || tiles.length === 0) {
      return 'Position: inconnue.';
    }

    const startTile = tiles[0] as any;
    const finishTile = tiles[tiles.length - 1] as any;
    const hasStart = startTile?.type === 'start';
    const hasFinish = finishTile?.type === 'finish';
    const maxCase = hasStart && hasFinish ? tiles.length - 1 : tiles.length;
    if (maxCase <= 0) {
      return 'Position: inconnue.';
    }

    const lapRaw = (meta?.laps as any)?.[userId];
    const lap = typeof lapRaw === 'number' ? lapRaw : Number(lapRaw);
    const tourPlateau = Number.isFinite(lap) ? String(Math.trunc(lap)) : '?';

    const caseNumber = Math.max(0, Math.trunc(pos));
    if (hasStart && hasFinish) {
      if (caseNumber <= 0) {
        return `Tour plateau ${tourPlateau}, départ (0/${maxCase}).`;
      }
      if (caseNumber >= maxCase) {
        return `Tour plateau ${tourPlateau}, arrivée (${maxCase}/${maxCase}).`;
      }
      return `Tour plateau ${tourPlateau}, case ${caseNumber}/${maxCase}.`;
    }

    // Fallback (compat): positions 0-based -> affichage 1-based.
    const display = Math.max(1, caseNumber + 1);
    return `Tour plateau ${tourPlateau}, case ${display}/${maxCase}.`;
  }
}
