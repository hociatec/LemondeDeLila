import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
import * as FouleesFantastiquesRulebook from '../rulebook/rulebook';
import { FOULEES_FANTASTIQUES_GAME } from '../definitions/game.definition';
import type { FouleesFantastiquesMetadata } from '../model/foulees-fantastiques-state.entity';

@Injectable()
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
    const meta = (state.metadata ?? {}) as any as FouleesFantastiquesMetadata;
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
        (pawn: any) => (pawn?.progress ?? -1) >= arrivalProgress,
      ).length;
      return `${name} : ${arrived} arrivé${arrived > 1 ? 's' : ''}`;
    });

    const arrivalProgress =
      (meta.trackLength ?? 0) + (meta.homeLength ?? 0) - 1;
    const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
      ? meta.pawnsByPlayer[userId]
      : [];
    const myColor = meta.colorsByPlayer?.[userId];

    const inStable = myPawns.filter((p: any) => (p?.progress ?? -1) < 0).length;
    const inHome = myPawns.filter(
      (p: any) =>
        typeof p?.progress === 'number' &&
        p.progress >= meta.trackLength &&
        p.progress < arrivalProgress,
    ).length;
    const finished = myPawns.filter(
      (p: any) => (p?.progress ?? -1) >= arrivalProgress,
    ).length;
    const out = myPawns.filter(
      (p: any) =>
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
      const names = (meta as any)?.pawnNamesByPlayer?.[userId];
      for (const pawn of out) {
        const pos = (offset + pawn.progress) % meta.trackLength;
        const label =
          Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string'
            ? String(names[pawn.pawnIndex]).trim()
            : `animal ${pawn.pawnIndex + 1}`;
        stableLines.push(
          `${label}: case ${pos + 1}/${meta.trackLength}.`,
        );
      }
    } else {
      stableLines.push('Aucun animal sorti.');
    }

    const positionLines: string[] = [];
    const allOnTrack: Array<{ pos: number; line: string }> = [];
    for (const p of players) {
      if (!p) continue;
      const offset = meta.offsets?.[p.id] ?? 0;
      const names = (meta as any)?.pawnNamesByPlayer?.[p.id];
      const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
        ? meta.pawnsByPlayer[p.id]
        : [];
      for (const pawn of pawns) {
        const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
        if (prog < 0 || prog >= meta.trackLength) continue;
        const pos = (offset + prog) % meta.trackLength;
        const label =
          Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string'
            ? String(names[pawn.pawnIndex]).trim()
            : `animal ${pawn.pawnIndex + 1}`;
        allOnTrack.push({
          pos,
          line: `${label}, tour 0, case ${pos + 1}/${meta.trackLength}.`,
        });
      }
    }
    allOnTrack.sort((a, b) => b.pos - a.pos);
    positionLines.push(...allOnTrack.map((x) => x.line));
    if (!positionLines.length) {
      positionLines.push('Aucun animal sorti.');
    }

    const extras = {
      ...(state as any).extras,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
        stable: stableLines,
        position: positionLines,
      },
      ui: {
        panels: {
          stable: {
            title: 'État',
            message: stableLines.length ? stableLines.join(' ') : 'État: inconnu.',
          },
          position: {
            title: 'Position',
            message: positionLines.length
              ? positionLines.join(' ')
              : this.boardPayload.buildPositionPanelMessage({
                  tilesRaw: meta.tiles,
                  positionsRaw: meta.positions,
                  lapsRaw: meta.laps,
                  playerId: userId,
                }),
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

    // Ne pas exposer le pending (liste de choix) aux autres joueurs :
    // c'est une décision à prendre uniquement par `pending.playerId`.
    const pendingForUser =
      state.pending && typeof (state.pending as any)?.playerId === 'number'
        ? (state.pending as any).playerId === userId
          ? state.pending
          : null
        : (state.pending ?? null);

    return {
      ...state,
      catalog: {
        phases: FOULEES_FANTASTIQUES_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: pendingForUser,
      extras,
      board: this.boardPayload.buildTilesPositionsLaps(
        meta.tiles,
        meta.positions,
        meta.laps,
      ),
    } as any;
  }
}
