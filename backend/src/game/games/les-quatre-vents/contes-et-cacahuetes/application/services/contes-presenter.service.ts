import type {
  GameLogEntry,
  GameStateEntity,
} from '../../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../application/models/game-action.model';

import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../application/services/board-payload.service';
import * as Rulebook from '../../rulebook/rulebook';
import { CONTES_CACAHUETES_GAME } from '../../definitions/game.definition';
import type {
  ContesCacahuetesMetadata,
  ContesNarration,
} from '../../model/contes-et-cacahuetes-state.model';

export class ContesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as ContesCacahuetesMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const scoreLines = players.map((p) => {
      const pid = Number(p?.id);
      const name =
        p?.username && String(p.username).trim()
          ? String(p.username).trim()
          : `Joueur ${pid}`;
      const position = Number(meta.positions?.[pid] ?? 0) + 1;
      return `${name} : case ${position}/60.`;
    });

    const stateRecord = state as unknown as Record<string, unknown>;
    const extras = {
      ...asRecord(stateRecord.extras),
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
      },
      ui: {
        panels: {
          score: {
            title: 'Score',
            message: scoreLines.join(' '),
          },
          status: {
            title: 'Statuts',
            message: this.buildStatusPanelMessage(meta, players),
          },
        },
      },
    };

    const logWithConte = this.insertConteNarration(
      state.log,
      meta.lastConte,
      userId,
    );

    return {
      ...state,
      log: logWithConte,
      catalog: {
        phases: CONTES_CACAHUETES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
      ),
    } as GameStateWithActions;
  }

  private insertConteNarration(
    log: GameLogEntry[] | undefined,
    narration: ContesNarration | null | undefined,
    viewerId: number,
  ): GameLogEntry[] {
    const entries = Array.isArray(log) ? [...log] : [];
    if (!narration || narration.playerId !== viewerId) {
      return entries;
    }
    const text = String(narration.text ?? '').trim();
    if (!text) {
      return entries;
    }
    const existing = entries.some((entry) => entry?.message === text);
    if (existing) {
      return entries;
    }
    entries.push({
      message: text,
      timestamp: narration.timestamp ?? new Date().toISOString(),
    });
    return entries;
  }

  private buildStatusPanelMessage(
    meta: ContesCacahuetesMetadata,
    players: Array<{ id?: number; username?: string | null }>,
  ): string {
    const lines = players.map((player) => {
      const pid = Number(player?.id);
      const name =
        player?.username && String(player.username).trim()
          ? String(player.username).trim()
          : `Joueur ${pid}`;
      const statuses: string[] = [];
      const statusMap =
        meta.statuses ?? ({} as ContesCacahuetesMetadata['statuses']);
      const addCount = (
        key: keyof ContesCacahuetesMetadata['statuses'],
        label: string,
      ) => {
        const count = Number(
          (statusMap[key] as Record<number, unknown>)?.[pid] ?? 0,
        );
        if (Number.isFinite(count) && count > 0)
          statuses.push(`${label} x${count}`);
      };
      const addFlag = (
        key: keyof ContesCacahuetesMetadata['statuses'],
        label: string,
      ) => {
        if ((statusMap[key] as Record<number, unknown>)?.[pid]) {
          statuses.push(label);
        }
      };

      addCount('skipTurn', 'tour passé');
      addCount('rerollToken', 'parchemin');
      addCount('shieldMalus', 'amulette');
      addCount('forcedRollOneTurns', 'dé limité');
      addCount('noBonusCardsTurns', 'bonus muets');
      addFlag('reverseNextTurn', 'livre à l’envers');
      addFlag('protectNextMalus', 'dragon');
      addFlag('ignoreNextConteAndAdvance', 'cape');
      addFlag('replaceOneOn1By4', 'feuille magique');
      addFlag('keyOfGold', 'clé d’or');
      if (
        typeof (statusMap.blockedUntilPassed as Record<number, unknown>)?.[
          pid
        ] === 'number'
      ) {
        statuses.push('bloqué par le loup');
      }

      return `${name} : ${statuses.length ? statuses.join(', ') : 'aucun statut'}.`;
    });

    return lines.length ? lines.join(' ') : 'Aucun statut.';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}







