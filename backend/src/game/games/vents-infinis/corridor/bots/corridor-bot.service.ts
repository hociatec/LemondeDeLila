import { Injectable } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import type { CorridorMetadata } from '../model/corridor.model';
import * as CorridorRulebook from '../rulebook/rulebook';

@Injectable()
export class CorridorBotService {
  constructor(private readonly botRunner: BotRunnerService) {}

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    const moveTargets = CorridorRulebook.listLegalPawnMoves(state, botPlayerId);
    const wallTargets = CorridorRulebook.listLegalWallPlacements(state, botPlayerId);

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
    const preferredMove = this.pickMoveTowardGoal(state, meta, botPlayerId, moveTargets);
    if (preferredMove != null) {
      return [{ type: 'corridor_move', payload: { x: preferredMove.x, y: preferredMove.y } }];
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
      { preferTypes: ['corridor_move'], fallbackTypes: ['corridor_move', 'corridor_place_wall'] },
    );
  }

  private pickMoveTowardGoal(
    state: GameStateEntity,
    meta: CorridorMetadata,
    botPlayerId: number,
    targets: Array<{ x: number; y: number }>,
  ): { x: number; y: number } | null {
    const size = meta?.size ?? 0;
    if (!size) return null;

    const players = state.players ?? [];
    const idx = players.findIndex((p) => p?.id === botPlayerId);
    if (idx < 0) return null;

    const goalY = idx === 0 ? size - 1 : 0;
    const dist = (p: { x: number; y: number }) => Math.abs(goalY - p.y);

    let best: { x: number; y: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const t of targets) {
      const d = dist(t);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }
}

