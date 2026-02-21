import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { LamaMetadata } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaLogService } from '../logging/lama-log.service';
import { createPendingState } from '../../../../modules/pending-action/services/pending-action.service';
import { optionalInt } from '../../../../core/helpers/payload-validators.helper';

@Injectable()
export class LamaReturnService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  applyReturnToken(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (meta.pendingReturnPlayerId !== actorId) {
      return state;
    }
    if (String(action.type ?? '') !== 'lama_return') {
      return state;
    }
    const value = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'value') ?? 0;
      } catch {
        return 0;
      }
    })();
    const currentScore = Number(
      (meta.scoresByPlayerId ?? {})[String(actorId)] ?? 0,
    );
    const delta = value === 10 ? 10 : value === 1 ? 1 : 0;
    const nextScore = Math.max(0, currentScore - delta);
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };
    scoresByPlayerId[String(actorId)] = nextScore;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    let log = state.log;
    if (delta === 10)
      log = this.logger.append(log, `${name} rend 1 diamant (10 jetons).`);
    else if (delta === 1)
      log = this.logger.append(log, `${name} rend 1 jeton.`);
    else log = this.logger.append(log, `${name} ne rend rien.`);

    const queue = Array.isArray(meta.pendingReturnQueue)
      ? [...meta.pendingReturnQueue]
      : [];
    const remaining = queue.filter((id) => id !== actorId);
    const nextPending = remaining.length ? remaining[0] : null;
    const nextMeta: LamaMetadata = {
      ...meta,
      scoresByPlayerId,
      pendingReturnQueue: remaining,
      pendingReturnPlayerId: nextPending,
      step: nextPending ? 'return_token' : 'turn_choice',
      suppressTurnAnnouncement: false,
    };

    const nextState = createPendingState(
      {
        ...state,
        metadata: nextMeta as any,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: nextPending ?? state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: nextPending
            ? `Rendre des jetons : ${this.shared.playerLabel(players as any[], nextPending)}`
            : undefined,
        },
      } as GameStateEntity,
      {
        step: nextMeta.step,
        playerId: nextMeta.pendingReturnPlayerId ?? null,
      } as any,
    );

    if (nextPending) {
      return nextState;
    }

    return this.round.finishRoundAndMaybeStartNext(nextState);
  }
}
