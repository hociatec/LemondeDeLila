import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';

@Injectable()
export class LamaPassService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyPass(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    if (!meta.allowPlayAfterDraw) return state;
    const tracker = meta.turnTracker ?? { playerId: actorId, drawn: false, played: false };
    if (
      this.shared.asNumberOrNull((tracker as any).playerId) !== actorId ||
      !this.shared.asBoolean((tracker as any).drawn) ||
      this.shared.asBoolean((tracker as any).played)
    ) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const log = this.logger.append(state.log, `${name} passe.`);

    const nextPlayerId = this.round.findNextActivePlayerId(players, meta, actorId);
    const nextMeta: LamaMetadata = {
      ...meta,
      turnTracker: { playerId: nextPlayerId, drawn: false, played: false },
    };

    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    if (this.round.isRoundEnded(nextMeta, players)) {
      const winnerId = this.round.findRoundWinnerId(nextMeta, players);
      return this.round.endRound(nextState, winnerId);
    }

    return nextState;
  }
}
