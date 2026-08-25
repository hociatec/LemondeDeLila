import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import type { GameShortcutHint } from '../../../../shortcuts/public-api';

type CompatibilityContext = {
  roomId: number;
  gameType: string;
  version: number;
  viewerPlayerId?: number | null;
  shortcuts: GameShortcutHint[];
};

@Injectable()
export class GameWsPayloadCompatibilityAdapter {
  build(
    state: GameStateEntity,
    context: CompatibilityContext,
  ): Record<string, unknown> {
    const record = this.asRecord(state);
    const extras = this.withViewerPlayerId(
      record.extras,
      context.viewerPlayerId,
    );
    const pending = this.withLegacyPendingChoices(
      record.pending,
      record.actions,
    );
    const metadata = this.withViewerLifecycle(
      record.metadata,
      pending,
      record.actions,
      context.viewerPlayerId,
    );
    const compatExtras = {
      ...this.withPendingChoicesExtras(extras, pending),
      shortcuts: context.shortcuts,
    };
    const payload = {
      ...record,
      pending,
      metadata,
      extras: compatExtras,
      roomId: record.roomId ?? context.roomId,
      gameType: record.gameType ?? context.gameType,
      version: record.version ?? context.version,
    };
    const nestedRecord = this.asRecord(record.state);
    const nestedState =
      record.state && typeof record.state === 'object'
        ? {
            ...nestedRecord,
            pending,
            metadata,
            extras: {
              ...this.withViewerPlayerId(
                this.withPendingChoicesExtras(
                  nestedRecord.extras ?? compatExtras,
                  pending,
                ),
                context.viewerPlayerId,
              ),
              shortcuts: context.shortcuts,
            },
            version: nestedRecord.version ?? payload.version ?? context.version,
          }
        : { ...payload };
    return { ...payload, state: nestedState };
  }

  private withLegacyPendingChoices(
    pending: unknown,
    actions: unknown,
  ): unknown {
    const record = this.asRecord(pending);
    if (!record.type) return pending;
    const rawChoices = Array.isArray(record.choices) ? record.choices : [];
    const choices = rawChoices
      .map((choice) => String(choice ?? '').trim())
      .filter((choice) => choice.length > 0);
    if (choices.length === 0) return pending;

    const data = this.asRecord(record.data);
    const actionList = Array.isArray(actions) ? actions : [];
    const choiceActionsByIndex = actionList
      .filter((action) => action && typeof action === 'object')
      .slice(0, choices.length)
      .map((action) => {
        const actionRecord = this.asRecord(action);
        return {
          type: actionRecord.type,
          payload: this.asRecord(actionRecord.payload),
        };
      });
    return {
      ...record,
      choices,
      data: {
        ...data,
        choices: Array.isArray(data.choices) ? data.choices : choices,
        options: Array.isArray(data.options) ? data.options : choices,
        choiceActionsByIndex:
          Array.isArray(data.choiceActionsByIndex) &&
          data.choiceActionsByIndex.length > 0
            ? data.choiceActionsByIndex
            : choiceActionsByIndex,
      },
    };
  }

  private withPendingChoicesExtras(
    extras: unknown,
    pending: unknown,
  ): Record<string, unknown> {
    const record = this.asRecord(extras);
    const pendingRecord = this.asRecord(pending);
    const choices = Array.isArray(pendingRecord.choices)
      ? pendingRecord.choices
      : [];
    return choices.length > 0 ? { ...record, pendingChoices: choices } : record;
  }

  private withViewerLifecycle(
    metadata: unknown,
    pending: unknown,
    actions: unknown,
    viewerPlayerId?: number | null,
  ): Record<string, unknown> {
    const record = this.asRecord(metadata);
    const pendingRecord = this.asRecord(pending);
    const pendingPlayerId = Number(pendingRecord.playerId);
    const viewerId = Number(viewerPlayerId);
    const hasActions = Array.isArray(actions) && actions.length > 0;
    const isViewerPending =
      Number.isFinite(pendingPlayerId) &&
      Number.isFinite(viewerId) &&
      pendingPlayerId === viewerId;
    const pendingType =
      typeof pendingRecord.type === 'string' ? pendingRecord.type.trim() : '';
    const isPawnPending =
      pendingType === 'choose_pawn' || pendingType === 'pick_pawn';
    const lifecycle = this.asRecord(record.lifecycle);
    return {
      ...record,
      lifecycle: {
        ...lifecycle,
        viewerTurnActionable:
          lifecycle.viewerTurnActionable ?? (isViewerPending && hasActions),
        viewerMustChoosePawn:
          lifecycle.viewerMustChoosePawn ??
          (isViewerPending && isPawnPending && hasActions),
      },
    };
  }

  private withViewerPlayerId(
    extras: unknown,
    viewerPlayerId?: number | null,
  ): Record<string, unknown> {
    const record = this.asRecord(extras);
    const viewerId = Number(viewerPlayerId);
    return viewerPlayerId != null && Number.isFinite(viewerId) && viewerId > 0
      ? { ...record, viewerPlayerId: viewerId }
      : record;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
