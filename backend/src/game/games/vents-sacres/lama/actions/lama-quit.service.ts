import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';

@Injectable()
export class LamaQuitService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyQuit(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const droppedOutByPlayerId = { ...(meta.droppedOutByPlayerId ?? {}) };
    if (droppedOutByPlayerId[String(actorId)]) return state;
    droppedOutByPlayerId[String(actorId)] = true;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    let log = this.logger.append(state.log, `${name} se retire de la manche.`);
    log = this.logger.append(log, `${name} ne jouera plus ; ses jetons seront comptés à la fin de la manche.`);

    const nextMeta: LamaMetadata = { ...meta, droppedOutByPlayerId, suppressTurnAnnouncement: false };
    const nextStateBase: GameStateEntity = { ...state, metadata: nextMeta as any, log };

    const roundNumber = Number(meta.roundNumber ?? 0);
    const alreadyLoggedRoundEnd =
      roundNumber > 0 &&
      Array.isArray(state.log) &&
      state.log.some((l: any) => String(l?.message ?? '') === `Fin de la manche ${roundNumber}.`);

    if (alreadyLoggedRoundEnd) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextStateBase, winnerId);
    }

    if (this.round.isRoundEnded(nextMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextStateBase, winnerId);
    }

    const nextPlayerId = this.round.findNextActivePlayerId(players, nextMeta, actorId);
    return {
      ...nextStateBase,
      turnIndex: (state.turnIndex ?? 0) + 1,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      metadata: { ...nextMeta, turnTracker: { playerId: nextPlayerId, drawn: false, played: false } } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };
  }
}
