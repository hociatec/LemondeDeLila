import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameStateWithActions } from '../../../../../core/application/models/game-action.model';

import { formatPresenterActions } from '../../../../../core/application/helpers/actions-presenter.helper';
import { BoardPayloadService } from '../../../../../core/application/services/board-payload.service';
import * as FouleesFantastiquesRulebook from '../../rulebook/rulebook';
import { FOULEES_FANTASTIQUES_GAME } from '../../definitions/game.definition';
import type {
  FouleesFantastiquesMetadata,
  FouleesFantastiquesPawnState,
} from '../../model/foulees-fantastiques-state.model';

type PresenterPendingState = {
  playerId?: number;
};

type PresenterExtras = Record<string, unknown>;

export class FouleesFantastiquesPresenterService {
  constructor(private readonly boardPayload: BoardPayloadService) {}

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = FouleesFantastiquesRulebook.getAvailableActions(
      state,
      userId,
    );
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const arrivalProgress =
      (meta.trackLength ?? 0) + (meta.homeLength ?? 0) - 1;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);
    const scoreLines = players.map((p) => {
      const name =
        typeof p?.username === 'string' && p.username.trim().length > 0
          ? p.username.trim()
          : `Joueur ${p?.id ?? '?'}`;
      const pid = p?.id ?? -1;
      const pawns = Array.isArray(meta.pawnsByPlayer?.[pid])
        ? meta.pawnsByPlayer[pid]
        : [];
      const arrived = pawns.filter(
        (pawn: FouleesFantastiquesPawnState) =>
          (pawn?.progress ?? -1) >= arrivalProgress,
      ).length;
      return `${name} : ${arrived} arrivé${arrived > 1 ? 's' : ''}`;
    });
    const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
      ? meta.pawnsByPlayer[userId]
      : [];
    const myColor = meta.colorsByPlayer?.[userId];

    const inStable = myPawns.filter(
      (p: FouleesFantastiquesPawnState) => (p?.progress ?? -1) < 0,
    ).length;
    const inHome = myPawns.filter(
      (p: FouleesFantastiquesPawnState) =>
        typeof p?.progress === 'number' &&
        p.progress >= meta.trackLength &&
        p.progress < arrivalProgress,
    ).length;
    const finished = myPawns.filter(
      (p: FouleesFantastiquesPawnState) =>
        (p?.progress ?? -1) >= arrivalProgress,
    ).length;
    const out = myPawns.filter(
      (p: FouleesFantastiquesPawnState) =>
        typeof p?.progress === 'number' &&
        p.progress >= 0 &&
        p.progress < meta.trackLength,
    );

    const stableLines: string[] = [];
    if (myColor) stableLines.push(`Couleur: ${myColor}.`);
    stableLines.push(`Départ: ${inStable}/4.`);
    stableLines.push(`Abri: ${inHome}/4.`);
    stableLines.push(`Arrivés: ${finished}/4.`);

    if (out.length) {
      const offset = meta.offsets?.[userId] ?? 0;
      const names = meta.pawnNamesByPlayer?.[userId];
      for (const pawn of out) {
        const pos = (offset + pawn.progress) % meta.trackLength;
        const label =
          Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string'
            ? String(names[pawn.pawnIndex]).trim()
            : `animal ${pawn.pawnIndex + 1}`;
        stableLines.push(`${label}: case ${pos + 1}/${meta.trackLength}.`);
      }
    } else {
      stableLines.push('Aucun animal sorti.');
    }

    const positionMessage =
      this.boardPayload.buildPawnProgressPositionPanelMessage({
        playersRaw: state.players,
        pawnsByPlayerRaw: meta.pawnsByPlayer,
        trackLengthRaw: meta.trackLength,
        homeLengthRaw: meta.homeLength,
        offsetsRaw: meta.offsets,
        pawnNamesByPlayerRaw: meta.pawnNamesByPlayer,
        stableLabel: 'Départ',
        homeLabel: 'Abri',
        arrivedLabel: 'Arrivés',
      });

    const extras = {
      ...((state as { extras?: PresenterExtras }).extras ?? {}),
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
        stable: stableLines,
        position: [positionMessage],
      },
      ui: {
        panels: {
          stable: {
            title: 'État',
            message: stableLines.length
              ? stableLines.join(' ')
              : 'État: inconnu.',
          },
          score: {
            title: 'Scores',
            message: scoreLines.length
              ? scoreLines.join('\n')
              : 'Scores: indisponibles.',
          },
        },
      },
    };

    const pendingForUser =
      state.pending &&
      typeof (state.pending as PresenterPendingState)?.playerId === 'number'
        ? (state.pending as PresenterPendingState).playerId === userId
          ? state.pending
          : null
        : (state.pending ?? null);

    return {
      ...state,
      catalog: {
        phases: FOULEES_FANTASTIQUES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      pending: pendingForUser,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
        meta.laps,
      ),
    };
  }
}



