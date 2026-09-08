import { Injectable } from '@nestjs/common';
import type {
  GameRuntime,
  GameRuntimeDescriptor,
} from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import type { GameStateWithActions } from '../../../../application/contracts/game-action.model';
import type { GameShortcutHint } from '../../../../../shortcuts/public-api';
import { projectDiceActionView } from '../../../../../engine/runtime/projection/dice-action-view';
import { GameVisibilityService } from '../../../../application/services/game-visibility.service';
import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';

type PresentStateInput = {
  state: GameStateEntity;
  handler: GameRuntime;
  roomId: number;
  gameType: string;
  version: number;
  viewerPlayerId?: number | null;
};
type GamePresentationDescriptor = NonNullable<
  GameRuntimeDescriptor['presentation']
>;
type ScorePresentationDescriptor = NonNullable<
  GamePresentationDescriptor['score']
>;

@Injectable()
export class GameWsStatePresenter {
  private readonly messages = new GameWsStateMessagesPresenter();

  constructor(private readonly visibility: GameVisibilityService) {}

  present(input: PresentStateInput): Record<string, unknown> {
    const exposedByGame = this.expose(
      input.handler,
      input.state,
      input.viewerPlayerId,
    );
    const exposed = projectDiceActionView(
      this.visibility.project(
        input.state,
        exposedByGame,
        Number(input.viewerPlayerId ?? 0) || null,
      ),
    );
    const presentation = this.presentation(input.handler);
    const kits = this.withScorePresentation(
      this.asRecord(exposed.kits),
      presentation.score,
      input.state.status,
    );
    const system = this.messages.withServerMessages(
      this.asRecord(exposed.system),
      Number(input.viewerPlayerId ?? 0) || null,
      presentation,
    );
    return {
      ...exposed,
      kits,
      roomId: input.roomId,
      gameType: input.gameType,
      viewerPlayerId: Number(input.viewerPlayerId ?? 0) || null,
      runId:
        typeof input.state.metadata?.roomRunId === 'number'
          ? input.state.metadata.roomRunId
          : 0,
      version: input.version,
      system: {
        ...system,
        shortcuts: this.resolveShortcuts(
          input.handler,
          input.state,
          exposed,
          kits,
        ),
      },
    };
  }

  private expose(
    handler: GameRuntime,
    state: GameStateEntity,
    viewerPlayerId?: number | null,
  ): GameStateWithActions {
    const viewerId = Number(viewerPlayerId ?? 0);
    if (Number.isFinite(viewerId) && viewerId > 0) {
      return handler.exposeStateForUser(state, viewerId);
    }
    return handler.exposeStateForUser(state, null);
  }

  private resolveShortcuts(
    handler: GameRuntime,
    state: GameStateEntity,
    exposed: GameStateWithActions,
    kits: Record<string, unknown>,
  ): GameShortcutHint[] {
    const declaredShortcuts = handler.getShortcuts({
      currentPlayerId: state.turn?.currentPlayerId ?? null,
      started: this.isActiveMatchStatus(state.status),
    });
    const score = this.asRecord(kits.score);
    const hasScore = Object.keys(score).length > 0;
    const declaredScoreKey = declaredShortcuts.find(
      (shortcut) =>
        this.stringValue(shortcut.key).toUpperCase() === 'S' &&
        shortcut.type === 'interface',
    );
    const shortcuts = declaredShortcuts.filter(
      (shortcut) =>
        !hasScore ||
        this.stringValue(shortcut.key).toUpperCase() !== 'S' ||
        shortcut === declaredScoreKey,
    );
    if (hasScore && !declaredScoreKey) {
      shortcuts.push({
        key: 'S',
        type: 'interface',
        id: 'score',
        label: this.stringValue(score.label) || 'Scores',
      });
    }
    return this.withActionShortcutLabels(shortcuts, exposed, kits);
  }

  private withActionShortcutLabels(
    shortcuts: GameShortcutHint[],
    exposed: GameStateWithActions,
    kits: Record<string, unknown>,
  ): GameShortcutHint[] {
    const actions = this.exposedActions(exposed);
    const actionTypes = new Set(
      actions
        .map((action) => action.type)
        .filter((type): type is string => typeof type === 'string'),
    );
    return shortcuts
      .filter(
        (shortcut) =>
          (shortcut.type === 'interface' &&
            (shortcut.id !== 'score' ||
              Object.keys(this.asRecord(kits.score)).length > 0)) ||
          (shortcut.type === 'action' && actionTypes.has(shortcut.actionType)),
      )
      .map((shortcut) => this.withActionShortcutLabel(shortcut, actions));
  }

  private exposedActions(
    exposed: GameStateWithActions,
  ): Record<string, unknown>[] {
    const rawActions = exposed.actions;
    return (Array.isArray(rawActions) ? rawActions : []).map((action) =>
      this.asRecord(action),
    );
  }

  private withActionShortcutLabel(
    shortcut: GameShortcutHint,
    actions: readonly Record<string, unknown>[],
  ): GameShortcutHint {
    if (shortcut.label || shortcut.type === 'interface') return shortcut;
    const action = actions.find(
      (candidate) => candidate.type === shortcut.actionType,
    );
    const label = typeof action?.label === 'string' ? action.label.trim() : '';
    return label ? { ...shortcut, label } : shortcut;
  }

  private presentation(handler: GameRuntime): GamePresentationDescriptor {
    if (typeof handler.getDescriptor !== 'function') return {};
    return handler.getDescriptor().presentation ?? {};
  }

  private withScorePresentation(
    kits: Record<string, unknown>,
    presentation?: ScorePresentationDescriptor,
    status?: unknown,
  ): Record<string, unknown> {
    if (
      presentation?.visibility === 'active-match' &&
      !this.isActiveMatchStatus(status)
    ) {
      return { ...kits, score: null };
    }
    const score = this.asRecord(kits.score);
    if (Object.keys(score).length === 0) return kits;
    return {
      ...kits,
      score: {
        ...score,
        label: presentation?.label ?? 'Scores',
        unit: presentation?.unit ?? { singular: 'point', plural: 'points' },
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isActiveMatchStatus(value: unknown): boolean {
    const status = this.stringValue(value).toLowerCase();
    return status === 'started' || status === 'playing';
  }
}
