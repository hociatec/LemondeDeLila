import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import type { PlayerStateEntity } from '../../../../../application/models/game-state.model';

import type { LamaMetadata } from '../../model/lama.model';
import { LamaSharedService } from './lama-shared.service';
import { LamaDrawService } from './lama-draw.service';
import { LamaPassService } from './lama-pass.service';
import { LamaPlayService } from './lama-play.service';
import { LamaQuitService } from './lama-quit.service';
import { LamaReturnService } from './lama-return.service';
import { LamaInfoService } from './lama-info.service';
import { LamaSetupService } from './lama-setup.service';
import { LamaLogService } from './lama-log.service';

import {
  applyActionsSequentially,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import { asLamaRecord } from './lama-action.utils';

export class LamaActionService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly drawService: LamaDrawService,
    private readonly passService: LamaPassService,
    private readonly playService: LamaPlayService,
    private readonly quitService: LamaQuitService,
    private readonly returnService: LamaReturnService,
    private readonly infoService: LamaInfoService,
    private readonly setupService: LamaSetupService,
    private readonly logger: LamaLogService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return applyActionsSequentially(state, actions, (next, action) => {
      const applied = this.applyOne(next, action);
      return this.appendTurnAnnouncementIfNeeded(next, applied);
    });
  }

  private appendTurnAnnouncementIfNeeded(
    previous: GameStateEntity,
    next: GameStateEntity,
  ): GameStateEntity {
    const previousStatus = String(previous.status ?? '').toLowerCase();
    const nextStatus = String(next.status ?? '').toLowerCase();
    if (previousStatus !== 'started' || nextStatus !== 'started') {
      return next;
    }
    const prevPlayerId = previous.turn?.currentPlayerId ?? null;
    const nextPlayerId = next.turn?.currentPlayerId ?? null;
    if (
      prevPlayerId == null ||
      nextPlayerId == null ||
      prevPlayerId === nextPlayerId
    ) {
      return next;
    }

    const players = Array.isArray(next.players) ? next.players : [];
    const name = this.shared.playerLabel(players, nextPlayerId);
    const message = `C'est au tour de ${name}.`;
    const log = this.logger.append(next.log, message);

    const meta = { ...(next.metadata ?? {}) } as LamaMetadata;
    return {
      ...next,
      log,
      metadata: {
        ...meta,
        suppressTurnAnnouncement: true,
      },
    };
  }

  private applyOne(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const type = normalizeActionType(action);
    if (!type) return state;

    const actorFromMeta = asLamaRecord(action.meta).actorId;
    const actorId =
      typeof actorFromMeta === 'number'
        ? actorFromMeta
        : (state.turn?.currentPlayerId ?? null);
    if (!actorId) return state;

    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    if (meta.winnerId) return state;

    const players = Array.isArray(state.players) ? state.players : [];

    const status = String(state.status ?? '').toLowerCase();

    if (type === 'lama_peek_discard' || type === 'lama_preview') {
      return this.infoService.applyInfoAction(state, meta, type, actorId);
    }

    if ((meta.step ?? '') === 'setup_config') {
      if (type !== 'lama_set_config') return state;
      return this.setupService.applySetupConfig(state, meta, action, actorId);
    }

    if ((meta.step ?? '') === 'round_pause') {
      if (type !== 'lama_resume_round') return state;
      return this.setupService.resumeRoundPause(state, meta);
    }

    if (status !== 'started') {
      return state;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId == null || actorId !== currentPlayerId) {
      return state;
    }

    const metaForTurn = this.shared.ensureTurnTracker(meta, actorId);

    if ((meta.step ?? 'turn_choice') === 'return_token') {
      return this.returnService.applyReturnToken(
        state,
        metaForTurn,
        actorId,
        action,
      );
    }

    if (type === 'draw') {
      if (meta.droppedOutByPlayerId?.[String(actorId)]) return state;
      try {
        const current =
          players.find(
            (p): p is PlayerStateEntity => typeof p?.id === 'number' && p.id === actorId,
          ) ?? null;
        const isBot = Boolean(current?.isBot);
        const tracker = metaForTurn.turnTracker ?? null;
        const lastDrawMap = metaForTurn.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex =
          lastDrawMap && typeof lastDrawMap === 'object'
            ? this.shared.asNumberOrNull(lastDrawMap[String(actorId)])
            : null;
        const justDrew =
          lastDrawIndex != null &&
          lastDrawIndex === Number(state.turnIndex ?? 0);
        const alreadyDrawn =
          this.shared.asNumberOrNull(tracker?.playerId) === actorId &&
          this.shared.asBoolean(tracker?.drawn);
        if (isBot && !alreadyDrawn) {
          const name = this.shared.playerLabel(players, actorId);
          if (!justDrew) {
            const logWithWarning = this.logger.append(
              state.log,
              `${name} doit piocher.`,
            );
            return this.drawService.applyDraw(
              { ...state, log: logWithWarning },
              metaForTurn,
              actorId,
            );
          }
          return this.drawService.applyDraw(state, metaForTurn, actorId);
        }
      } catch {
        // ignore
      }
      return this.drawService.applyDraw(state, metaForTurn, actorId);
    }

    if (type === 'lama_quit') {
      return this.quitService.applyQuit(state, metaForTurn, actorId);
    }

    if (type === 'lama_pass') {
      const allowPlayAfterDraw = this.shared.asBoolean(
        metaForTurn.allowPlayAfterDraw,
      );
      const tracker = metaForTurn.turnTracker ?? null;
      const trackerDrawn = this.shared.asBoolean(tracker?.drawn);
      const trackerPlayed = this.shared.asBoolean(tracker?.played);

      // Backward compatibility:
      // - Older clients used `lama_pass` to mean "leave the round" (official rule).
      // - When `allowPlayAfterDraw` is enabled, `lama_pass` means "end the turn" *after drawing*.
      if (allowPlayAfterDraw && trackerDrawn && !trackerPlayed) {
        return this.passService.applyPass(state, metaForTurn, actorId);
      }

      return this.quitService.applyQuit(state, metaForTurn, actorId);
    }

    if (type === 'lama_play') {
      if (meta.droppedOutByPlayerId[String(actorId)]) return state;
      return this.playService.applyPlay(state, metaForTurn, actorId, action);
    }

    return state;
  }
}



