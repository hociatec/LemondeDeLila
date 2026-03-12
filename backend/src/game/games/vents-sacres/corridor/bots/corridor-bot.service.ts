import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';

@Injectable()
export class CorridorBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const meta = (state.metadata ?? {}) as CorridorMetadata;
    if (String(meta.setupStep ?? '') === 'setup_config') {
      return [
        {
          type: 'corridor_set_config',
          payload: { wallsPerPlayer: meta.wallsPerPlayer ?? 10 },
        },
      ];
    }
    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn') {
      const pawns = Array.isArray((state.pending?.data as any)?.pawns)
        ? ((state.pending?.data as any).pawns as Array<any>)
        : [];
      const first = pawns[0];
      const pawnId = String(first?.id ?? '').trim();
      if (!pawnId) return [];
      return [{ type: 'choose_pawn', payload: { pawnId } }];
    }

    const moveTargets = CorridorRulebook.listLegalPawnMoves(state, botPlayerId);
    const wallTargets = CorridorRulebook.listLegalWallPlacements(
      state,
      botPlayerId,
    );

    const moveActions: GameSingleActionDto[] = moveTargets.map((to) => ({
      type: 'corridor_move',
      payload: { x: to.x, y: to.y },
    }));

    // Heuristique simple:
    // - si un coup gagne immédiatement, le prendre
    for (const to of moveTargets) {
      if (CorridorRulebook.isWinningPos(state, botPlayerId, to)) {
        return [{ type: 'corridor_move', payload: { x: to.x, y: to.y } }];
      }
    }

    // - sinon, avancer vers l’objectif (réduit la distance en Y)
    const players = state.players ?? [];
    const oppId = players.find((p) => p?.id !== botPlayerId)?.id ?? null;
    const myGoalY = CorridorRulebook.getGoalYForPlayer(state, botPlayerId);
    const oppGoalY =
      oppId != null ? CorridorRulebook.getGoalYForPlayer(state, oppId) : null;
    if (myGoalY == null || (oppId != null && oppGoalY == null)) {
      return [];
    }
    const myPos = CorridorRulebook.getPawnPos(meta, botPlayerId);
    const oppPos =
      oppId != null ? CorridorRulebook.getPawnPos(meta, oppId) : null;

    const myDist =
      myPos != null
        ? CorridorRulebook.shortestDistanceToGoal(meta, myPos, myGoalY)
        : null;
    const oppDist =
      oppPos != null && oppGoalY != null
        ? CorridorRulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY)
        : null;

    const remaining =
      (meta?.wallsRemainingByPlayerId ?? {})[String(botPlayerId)] ?? 0;

    // Bot agressif:
    // 1) Anti-victoire: si l'adversaire a un coup gagnant au prochain tour, poser un mur qui l'empêche.
    if (
      remaining > 0 &&
      oppId != null &&
      oppPos != null &&
      wallTargets.length > 0
    ) {
      const opponentId = oppId;
      const opponentGoalY = oppGoalY as number;
      const opponentWinNow = (() => {
        const moves = CorridorRulebook.listLegalPawnMoves(state, opponentId);
        return moves.some((m) =>
          CorridorRulebook.isWinningPos(state, opponentId, m),
        );
      })();

      if (opponentWinNow) {
        const bestAntiWin = this.pickWallToPreventImmediateWin(
          state,
          meta,
          botPlayerId,
          opponentId,
          myGoalY,
          opponentGoalY,
          myPos,
          oppPos,
          wallTargets,
        );
        if (bestAntiWin != null) {
          return [
            {
              type: 'corridor_place_wall',
              payload: { x: bestAntiWin.x, y: bestAntiWin.y, o: bestAntiWin.o },
            },
          ];
        }
      }
    }

    // 2) Bloquer si l'adversaire est en avance/proche du but, ou parfois pour prendre l'initiative.
    const shouldConsiderWalls =
      remaining > 0 &&
      oppId != null &&
      oppPos != null &&
      oppDist != null &&
      (oppDist <= 4 || (myDist != null && oppDist <= myDist + 1));

    const wantAggressiveWall =
      shouldConsiderWalls &&
      (oppDist <= 3 ||
        (myDist != null && oppDist < myDist) ||
        // Initiative: un peu d'aléatoire pour que le bot place aussi des murs en début de partie.
        Math.random() < 0.35);

    if (
      wantAggressiveWall &&
      wallTargets.length > 0 &&
      myPos &&
      oppPos &&
      myDist != null &&
      oppDist != null
    ) {
      const opponentGoalY = oppGoalY as number;
      const bestWall = this.pickAggressiveWall(
        meta,
        myGoalY,
        opponentGoalY,
        myPos,
        oppPos,
        wallTargets,
      );
      if (bestWall != null) {
        return [
          {
            type: 'corridor_place_wall',
            payload: { x: bestWall.x, y: bestWall.y, o: bestWall.o },
          },
        ];
      }
    }

    const bestMove = this.pickMoveByShortestPath(
      meta,
      myGoalY,
      myPos,
      moveTargets,
    );
    if (bestMove != null) {
      return [
        { type: 'corridor_move', payload: { x: bestMove.x, y: bestMove.y } },
      ];
    }

    const wallActions: GameSingleActionDto[] = wallTargets.map((w) => ({
      type: 'corridor_place_wall',
      payload: { x: w.x, y: w.y, o: w.o },
    }));

    // Fallback: choix aléatoire, avec préférence au déplacement.
    return this.botRunner.choose(
      [...moveActions, ...wallActions],
      { state, playerId: botPlayerId },
      'random',
      {
        preferTypes: ['corridor_move'],
        fallbackTypes: ['corridor_move', 'corridor_place_wall'],
      },
    );
  }

  private pickMoveByShortestPath(
    meta: CorridorMetadata,
    goalY: number,
    start: { x: number; y: number } | null,
    targets: Array<{ x: number; y: number }>,
  ): { x: number; y: number } | null {
    if (!start) return null;
    if (targets.length === 0) return null;

    let best: { x: number; y: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const t of targets) {
      const d = CorridorRulebook.shortestDistanceToGoal(meta, t, goalY);
      if (d == null) continue;
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private pickAggressiveWall(
    meta: CorridorMetadata,
    myGoalY: number,
    oppGoalY: number,
    myPos: { x: number; y: number },
    oppPos: { x: number; y: number },
    walls: Array<{ x: number; y: number; o: 'h' | 'v' }>,
  ): { x: number; y: number; o: 'h' | 'v' } | null {
    const baseMy = CorridorRulebook.shortestDistanceToGoal(
      meta,
      myPos,
      myGoalY,
    );
    const baseOpp = CorridorRulebook.shortestDistanceToGoal(
      meta,
      oppPos,
      oppGoalY,
    );
    if (baseMy == null || baseOpp == null) return null;

    let best: { x: number; y: number; o: 'h' | 'v' } | null = null;
    let bestScore = 0;

    for (const w of walls) {
      const tmp = CorridorRulebook.applyWall(meta, w);
      const nextMy = CorridorRulebook.shortestDistanceToGoal(
        tmp,
        myPos,
        myGoalY,
      );
      const nextOpp = CorridorRulebook.shortestDistanceToGoal(
        tmp,
        oppPos,
        oppGoalY,
      );
      if (nextMy == null || nextOpp == null) continue;

      const oppGain = nextOpp - baseOpp;
      const myGain = nextMy - baseMy;

      const proximity = Math.abs(w.x - oppPos.x) + Math.abs(w.y - oppPos.y);
      const proximityBonus = proximity <= 1 ? 2 : proximity <= 2 ? 1 : 0;

      const score = oppGain * 4 - myGain * 2 + proximityBonus;
      if (score > bestScore && oppGain >= 1 && myGain <= 3) {
        bestScore = score;
        best = w;
      }
    }

    // Seuil volontairement bas: bot plus "méchant", il doit oser poser des murs.
    if (bestScore >= 2) {
      return best;
    }
    return null;
  }

  private pickWallToPreventImmediateWin(
    state: GameStateEntity,
    meta: CorridorMetadata,
    _botPlayerId: number,
    opponentId: number,
    myGoalY: number,
    oppGoalY: number,
    myPos: { x: number; y: number },
    oppPos: { x: number; y: number },
    walls: Array<{ x: number; y: number; o: 'h' | 'v' }>,
  ): { x: number; y: number; o: 'h' | 'v' } | null {
    const baseMy = CorridorRulebook.shortestDistanceToGoal(
      meta,
      myPos,
      myGoalY,
    );
    const baseOpp = CorridorRulebook.shortestDistanceToGoal(
      meta,
      oppPos,
      oppGoalY,
    );
    if (baseMy == null || baseOpp == null) return null;

    let best: { x: number; y: number; o: 'h' | 'v' } | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const w of walls) {
      const tmpMeta = CorridorRulebook.applyWall(meta, w);
      const tmpState = {
        ...(state as any),
        metadata: tmpMeta,
      } as GameStateEntity;
      const canStillWin = CorridorRulebook.listLegalPawnMoves(
        tmpState,
        opponentId,
      ).some((m) => CorridorRulebook.isWinningPos(tmpState, opponentId, m));
      if (canStillWin) continue;

      const nextMy = CorridorRulebook.shortestDistanceToGoal(
        tmpMeta,
        myPos,
        myGoalY,
      );
      const nextOpp = CorridorRulebook.shortestDistanceToGoal(
        tmpMeta,
        oppPos,
        oppGoalY,
      );
      if (nextMy == null || nextOpp == null) continue;

      const oppGain = nextOpp - baseOpp;
      const myGain = nextMy - baseMy;
      const score = oppGain * 5 - myGain * 2;
      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }

    return best;
  }
}
