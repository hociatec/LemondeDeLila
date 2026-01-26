import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { LamaMetadata } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaDrawService } from './lama-draw.service';
import { LamaPassService } from './lama-pass.service';
import { LamaPlayService } from './lama-play.service';
import { LamaQuitService } from './lama-quit.service';
import { LamaReturnService } from './lama-return.service';
import { LamaInfoService } from './lama-info.service';
import { LamaSetupService } from '../setup/lama-setup.service';

@Injectable()
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
  ) {}

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const type = String(action?.type ?? '').trim();
    if (!type) return state;

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
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
      return this.returnService.applyReturnToken(state, metaForTurn, actorId, action);
    }

    if (type === 'draw') {
      if (meta.droppedOutByPlayerId?.[String(actorId)]) return state;
      try {
        const current = players.find((p: any) => p?.id === actorId) as any;
        const isBot = Boolean(current?.isBot);
        const tracker = metaForTurn.turnTracker ?? null;
        const lastDrawMap: any = (metaForTurn as any)?.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex =
          lastDrawMap && typeof lastDrawMap === 'object'
            ? this.shared.asNumberOrNull(lastDrawMap[String(actorId)])
            : null;
        const justDrew = lastDrawIndex != null && lastDrawIndex === Number(state.turnIndex ?? 0);
        const alreadyDrawn =
          this.shared.asNumberOrNull((tracker as any)?.playerId) === actorId &&
          this.shared.asBoolean((tracker as any)?.drawn);
        if (isBot && !alreadyDrawn) {
          const name = this.shared.playerLabel(players, actorId);
          const log = Array.isArray(state.log) ? [...state.log] : [];
          if (!justDrew) {
            log.push({ message: `${name} doit piocher.` });
          }
          return this.drawService.applyDraw({ ...state, log }, metaForTurn, actorId);
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
      if (metaForTurn.droppedOutByPlayerId[String(actorId)]) return state;
      return this.passService.applyPass(state, metaForTurn, actorId);
    }

    if (type === 'lama_play') {
      if (meta.droppedOutByPlayerId[String(actorId)]) return state;
      return this.playService.applyPlay(state, metaForTurn, actorId, action);
    }

    return state;
  }
}
