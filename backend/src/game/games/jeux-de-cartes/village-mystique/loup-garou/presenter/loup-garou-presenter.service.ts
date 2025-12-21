import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameStateWithActions } from '../../../../../engine/dto/game-action.dto';
import { LOUP_GAROU_GAME } from '../definitions/game.definition';
import { LoupGarouActionService } from '../actions/loup-garou-action.service';
import { LoupGarouSetupService } from '../setup/loup-garou-setup.service';

@Injectable()
export class LoupGarouPresenterService {
  constructor(
    private readonly actions: LoupGarouActionService,
    private readonly setup: LoupGarouSetupService,
  ) {}

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
    const pending =
      meta.step === 'day-vote'
        ? { type: 'vote', name: meta.step, day: meta.day }
        : { type: 'phase', name: meta.step, day: meta.day };
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
