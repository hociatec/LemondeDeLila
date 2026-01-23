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

    const startIndex = tiles.findIndex((t: any) => t?.type === 'start');
    const finishIndex = tiles.findIndex((t: any) => t?.type === 'finish');
    const effectiveStart = startIndex >= 0 ? startIndex : 0;
    const effectiveFinish = finishIndex >= 0 ? finishIndex : tiles.length - 1;
    const maxCase = effectiveFinish > 0 ? effectiveFinish : tiles.length - 1;
    if (maxCase <= 0) {
      return 'Position: inconnue.';
    }

    const lapRaw = (meta?.laps as any)?.[userId];
    const lap = typeof lapRaw === 'number' ? lapRaw : Number(lapRaw);
    const tourPlateau = Number.isFinite(lap) ? String(Math.trunc(lap)) : '?';

    const caseNumber = Math.max(0, Math.trunc(pos));
    if (caseNumber < effectiveStart) {
      return `Tour plateau ${tourPlateau}, avant départ (${caseNumber}/${maxCase}).`;
    }
    if (caseNumber === effectiveStart) {
      return `Tour plateau ${tourPlateau}, départ (${caseNumber}/${maxCase}).`;
    }
    if (caseNumber >= effectiveFinish) {
      return `Tour plateau ${tourPlateau}, arrivée (${maxCase}/${maxCase}).`;
    }
    return `Tour plateau ${tourPlateau}, case ${caseNumber}/${maxCase}.`;
  }

  private buildBoardMessage(meta: JeuOieMetadata): string {
    const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
    if (tiles.length === 0) {
      return 'Plateau: indisponible.';
    }

    const startIndex = tiles.findIndex((t: any) => t?.type === 'start');
    const finishIndex = tiles.findIndex((t: any) => t?.type === 'finish');
    const from = startIndex >= 0 ? startIndex : 0;
    const to = finishIndex >= 0 ? finishIndex : tiles.length - 1;

    const lines: string[] = [];
    for (let i = from; i <= to; i += 1) {
      const t: any = tiles[i];
      const label = String(t?.label ?? '').trim() || `Case ${i}`;
      lines.push(`${i}: ${label}.`);
    }
    return lines.join('\n');
  }
}
