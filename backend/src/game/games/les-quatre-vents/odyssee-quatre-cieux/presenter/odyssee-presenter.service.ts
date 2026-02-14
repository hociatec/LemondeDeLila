import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import { ODYSSEE_GAME } from '../definitions/odyssee.definition';
import * as Rulebook from '../rulebook/rulebook';
import type { OdysseeMetadata } from '../model/odyssee.types';

@Injectable()
export class OdysseePresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = Rulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as OdysseeMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const trackLength = meta.trackLength ?? 0;
    const homeLength = meta.homeLength ?? 0;
    const arrivalProgress = trackLength + homeLength - 1;
    const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
      ? meta.pawnsByPlayer[userId]
      : [];
    const inBase = myPawns.filter((p) => (p?.progress ?? -1) < 0).length;
    const inHangar = myPawns.filter(
      (p) =>
        typeof p?.progress === 'number' &&
        p.progress >= trackLength &&
        p.progress < arrivalProgress,
    ).length;
    const finished = myPawns.filter(
      (p) => (p?.progress ?? -1) >= arrivalProgress,
    ).length;
    const onTrack = myPawns.filter(
      (p) =>
        typeof p?.progress === 'number' &&
        p.progress >= 0 &&
        p.progress < trackLength,
    );
    const stableLines: string[] = [];
    stableLines.push('Couleur: inconnue.');
    stableLines.push(`Base: ${inBase}/4.`);
    stableLines.push(`Hangar: ${inHangar}/4.`);
    stableLines.push(`Arrivée: ${finished}/4.`);
    if (onTrack.length) {
      const parts = onTrack
        .map((p) => `Pion ${p.pawnIndex + 1}: ${p.progress}`)
        .join(', ');
      stableLines.push(`Positions: ${parts}.`);
    } else {
      stableLines.push('Positions: aucune.');
    }
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const pid = p?.id ?? -1;
      const pawns = Array.isArray(meta.pawnsByPlayer?.[pid])
        ? meta.pawnsByPlayer[pid]
        : [];
      const done = pawns.filter(
        (pawn) => (pawn?.progress ?? -1) >= arrivalProgress,
      ).length;
      return `${name} : ${done} arrivé${done > 1 ? 's' : ''}`;
    });

    return {
      ...state,
      catalog: {
        phases: ODYSSEE_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: state.pending ?? null,
      extras: {
        ...(state as any).extras,
        currentPlayerView: {
          id: userId,
          username: me?.username ?? `Joueur ${userId}`,
        },
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: (() => {
                const pawns = Array.isArray(meta.pawnsByPlayer?.[userId])
                  ? meta.pawnsByPlayer[userId]
                  : [];
                if (pawns.length === 0) return 'Position: inconnue.';

                const parts = pawns
                  .filter((p) => p && typeof p.pawnIndex === 'number' && typeof p.progress === 'number')
                  .map((p) => `Pion ${p.pawnIndex + 1}: ${p.progress}`);
                if (parts.length === 0) return 'Position: inconnue.';
                return `Pions: ${parts.join(', ')}.`;
              })(),
            },
            stable: {
              title: 'État',
              message: stableLines.join(' '),
            },
            score: {
              title: 'Scores',
              message: scoreLines.length
                ? scoreLines.join('\n')
                : 'Scores: indisponibles.',
            },
          },
        },
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
