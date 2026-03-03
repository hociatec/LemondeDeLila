import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { CORRIDOR_GAME } from '../definitions/game.definition';
import { CORRIDOR_PAWNS } from '../definitions/corridor.pawns';
import type { CorridorMetadata } from '../model/corridor.model';
import { nextRngInt } from '../../../../../common/utils/seeded-rng';

@Injectable()
export class CorridorSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    if (status !== 'started') {
      return {
        ...baseState,
        metadata: {
          ...(baseState.metadata ?? {}),
          size: CORRIDOR_GAME.boardSize,
          winnerPlayerId: null,
        } as any,
      };
    }

    const players = baseState.players ?? [];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new Error('Nombre de joueurs insuffisant pour demarrer Le Corridor.');
    }

    const size = CORRIDOR_GAME.boardSize;
    const p1 = players[0];
    const p2 = players[1];
    const startX = Math.floor(size / 2);

    const pawnChoices = CORRIDOR_PAWNS.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
    }));

    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const pawnByPlayerId: Record<string, string> = {};
    const usedPawnIds = new Set<string>();
    for (const bot of players.filter((p) => p?.isBot === true)) {
      const pick = pawnChoices.find((pawn) => !usedPawnIds.has(pawn.id));
      if (!pick) break;
      pawnByPlayerId[String(bot.id)] = pick.id;
      usedPawnIds.add(pick.id);
    }

    const eligible = players.filter(
      (p) => p?.isBot !== true && !pawnByPlayerId[String(p?.id ?? '')],
    );
    const pick = eligible.length > 1 ? nextRngInt(baseMeta, eligible.length) : null;
    const pendingPlayerId =
      eligible.length <= 0
        ? null
        : eligible.length === 1
          ? eligible[0]!.id ?? null
          : (eligible[pick!.value]?.id ?? eligible[0]!.id ?? null);
    const metaAfterPick = pick?.meta ?? baseMeta;

    const metadata: CorridorMetadata = {
      size,
      setupStarterId: p1.id,
      pawns: pawnChoices,
      pawnByPlayerId,
      pawnsByPlayerId: {
        [String(p1.id)]: { x: startX, y: 0 },
        [String(p2.id)]: { x: startX, y: size - 1 },
      },
      goalYByPlayerId: {
        [String(p1.id)]: size - 1,
        [String(p2.id)]: 0,
      },
      walls: { h: [], v: [] },
      wallsRemainingByPlayerId: {
        [String(p1.id)]: CORRIDOR_GAME.wallsPerPlayer,
        [String(p2.id)]: CORRIDOR_GAME.wallsPerPlayer,
      },
      winnerPlayerId: null,
      winnerId: null,
    };

    const pendingChoices = pawnChoices
      .filter((pawn) => !usedPawnIds.has(pawn.id))
      .map((pawn) => ({
        id: pawn.id,
        label: `${pawn.label} - ${pawn.description}`,
        description: pawn.description,
      }));

    return {
      ...baseState,
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      metadata: { ...metaAfterPick, ...(metadata as any) },
      pending:
        pendingPlayerId != null
          ? {
              type: 'choose_pawn',
              label: 'Votre pion.',
              playerId: pendingPlayerId,
              blocking: true,
              data: {
                pawns: pendingChoices,
              },
            }
          : null,
      log: [...(baseState.log ?? [])],
      turn: {
        currentPlayerId: pendingPlayerId ?? p1.id,
        direction: 1,
        label: pendingPlayerId != null ? 'Choix du pion' : `Tour de ${p1.username}`,
      },
    };
  }
}
