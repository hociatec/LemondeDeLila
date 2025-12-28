import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { LOUP_GAROU_GAME } from '../definitions/game.definition';
import { LoupGarouActionService } from '../actions/loup-garou-action.service';
import { LoupGarouSetupService } from '../setup/loup-garou-setup.service';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GarouMetadata } from '../model/loup-garou.types';

@Injectable()
export class LoupGarouPresenterService {
  constructor(
    private readonly actions: LoupGarouActionService,
    private readonly setup: LoupGarouSetupService,
  ) {}

  private usernameOf(state: GameStateEntity, playerId: number): string {
    const player: any = (state.players ?? []).find((p: any) => p?.id === playerId);
    return String(player?.username ?? `Joueur ${playerId}`);
  }

  private buildPending(
    state: GameStateEntity,
    meta: GarouMetadata,
    currentPlayerId: number | null,
    actions: GameSingleActionDto[],
  ): any {
    const step = meta.step;
    const data = { step, day: meta.day };

    const requiresChoice = ['seer', 'cupid', 'wolves', 'witch', 'day-vote'].includes(step);
    if (!requiresChoice) {
      return { type: 'phase', label: step, playerId: null, blocking: false, data };
    }

    const label =
      step === 'seer'
        ? 'Voyante : choisissez un joueur à observer.'
        : step === 'cupid'
          ? 'Cupidon : choisissez deux amoureux.'
          : step === 'wolves'
            ? 'Loups : choisissez une victime.'
            : step === 'witch'
              ? 'Sorcière : choisissez une action.'
              : 'Vote : choisissez un joueur (ou abstention).';

    const choices = (actions ?? []).map((a) => {
      if (step === 'seer' && a.type === 'seer_peek') {
        const targetId = Number((a.payload as any)?.targetId);
        return this.usernameOf(state, targetId);
      }
      if (step === 'cupid' && a.type === 'cupid_link') {
        const aId = Number((a.payload as any)?.a);
        const bId = Number((a.payload as any)?.b);
        return `${this.usernameOf(state, aId)} + ${this.usernameOf(state, bId)}`;
      }
      if (step === 'wolves' && a.type === 'wolves_choose') {
        const targetId = Number((a.payload as any)?.targetId);
        return this.usernameOf(state, targetId);
      }
      if (step === 'witch' && a.type === 'witch_decide') {
        const save = Boolean((a.payload as any)?.save);
        const killTargetIdRaw = (a.payload as any)?.killTargetId;
        const killTargetId = killTargetIdRaw == null ? null : Number(killTargetIdRaw);
        if (save) {
          const wolvesTarget = meta.pending?.wolvesTarget;
          const who = typeof wolvesTarget === 'number' ? ` (${this.usernameOf(state, wolvesTarget)})` : '';
          return `Sauver la victime${who}`;
        }
        if (killTargetId != null && Number.isFinite(killTargetId)) {
          return `Empoisonner ${this.usernameOf(state, killTargetId)}`;
        }
        return 'Ne rien faire';
      }
      if (step === 'day-vote' && a.type === 'day_vote') {
        const targetIdRaw = (a.payload as any)?.targetId;
        const targetId = targetIdRaw == null ? null : Number(targetIdRaw);
        if (targetId == null || !Number.isFinite(targetId) || targetId < 0) {
          return 'Abstention';
        }
        return this.usernameOf(state, targetId);
      }
      return a.type;
    });

    return {
      type: step,
      label,
      playerId: currentPlayerId,
      blocking: true,
      choices,
      data,
    };
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const currentId = state.turn?.currentPlayerId ?? null;
    const actions =
      typeof currentId === 'number'
        ? this.actions.getAvailableActions(state, currentId)
        : [];
    const meta = this.setup.metadataOf(state);
    const sanitizedMeta: any = { ...(meta as any) };
    delete sanitizedMeta.roles;
    // Ne jamais exposer des infos privées sans userId (évite les fuites via getState()).
    if (sanitizedMeta.lastPeek) {
      delete sanitizedMeta.lastPeek;
    }
    const pending = this.buildPending(state, meta, currentId, actions);
    return {
      ...(state as any),
      catalog: {
        roles: LOUP_GAROU_GAME.roles.map((r) => ({ id: r.id, name: r.name })),
        phases: LOUP_GAROU_GAME.phaseOrder.map((p) => p.id),
        victory: LOUP_GAROU_GAME.victory,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending,
      metadata: sanitizedMeta,
    };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const exposed = this.exposeState(state);
    const meta = this.setup.metadataOf(state);
    const myRole = meta.roles?.[userId] ?? null;

    const sanitizedMeta: any = { ...(exposed as any).metadata };
    // roles est déjà supprimé dans exposeState, mais on garde une défense en profondeur.
    delete sanitizedMeta.roles;
    // Ne montrer lastPeek qu'au seer concerné (sinon fuite de rôle).
    const lastPeek = (meta as any)?.lastPeek ?? null;
    if (
      lastPeek &&
      typeof lastPeek.seerId === 'number' &&
      lastPeek.seerId === userId
    ) {
      sanitizedMeta.lastPeek = lastPeek;
    } else {
      delete sanitizedMeta.lastPeek;
    }

    return {
      ...(exposed as any),
      metadata: { ...sanitizedMeta, myRole },
    };
  }
}
