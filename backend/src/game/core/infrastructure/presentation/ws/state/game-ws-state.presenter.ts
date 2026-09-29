import { Injectable } from '@nestjs/common';
import type {
  GameRuntime,
  GameRuntimeDescriptor,
} from '../../../../application/ports/game-runtime.port';
import type { GameState } from '../../../../application/models/game-state.model';
import type { GameStateWithActions } from '../../../../application/models/game-action.model';
import type { GameShortcutHint } from '../../../../../shortcuts/public-api';
import { projectDiceActionView } from '../../../../../engine/runtime/projection/dice-action-view';
import { GameVisibilityService } from '../../../../application/services/game-visibility.service';
import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';
import type { ScorePlayerView } from '../../../../../engine/runtime/kits/player-values-kit';

type PresentedScore = ScorePlayerView & {
  label: string;
  unit: { singular: string; plural: string };
};
type PresentedGameKits = Record<string, unknown> & {
  score: PresentedScore | null;
};

type PresentStateInput = {
  state: GameState;
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
        this.safeViewerId(input.viewerPlayerId),
      ),
    );
    const presentation = this.presentation(input.handler);
    const kits = this.withScorePresentation(
      exposed.kits,
      presentation.score,
      input.state.status,
    );
    const system = this.messages.withServerMessages(
      exposed.system,
      this.safeViewerId(input.viewerPlayerId),
      presentation,
    );
    return {
      ...exposed,
      kits,
      roomId: input.roomId,
      gameType: input.gameType,
      viewerPlayerId: this.safeViewerId(input.viewerPlayerId),
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
    state: GameState,
    viewerPlayerId?: number | null,
  ): GameStateWithActions {
    const viewerId = this.safeViewerId(viewerPlayerId);
    if (viewerId !== null) {
      return handler.exposeStateForUser(state, viewerId);
    }
    return handler.exposeStateForUser(state, null);
  }

  private resolveShortcuts(
    handler: GameRuntime,
    state: GameState,
    exposed: GameStateWithActions,
    kits: PresentedGameKits,
  ): GameShortcutHint[] {
    const declaredShortcuts = handler.getShortcuts({
      currentPlayerId: state.turn?.currentPlayerId ?? null,
      started: this.isActiveMatchStatus(state.status),
    });
    const score = kits.score;
    const hasScore = score !== null;
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
        label: score?.label ?? 'Scores',
      });
    }
    return this.withActionShortcutLabels(shortcuts, exposed, kits);
  }

  private withActionShortcutLabels(
    shortcuts: GameShortcutHint[],
    exposed: GameStateWithActions,
    kits: PresentedGameKits,
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
            (shortcut.id !== 'score' || kits.score !== null)) ||
          (shortcut.type === 'action' && actionTypes.has(shortcut.actionType)),
      )
      .map((shortcut) => this.withActionShortcutLabel(shortcut, actions));
  }

  private exposedActions(
    exposed: GameStateWithActions,
  ): NonNullable<GameStateWithActions['actions']> {
    return exposed.actions ?? [];
  }

  private withActionShortcutLabel(
    shortcut: GameShortcutHint,
    actions: readonly NonNullable<GameStateWithActions['actions']>[number][],
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
    rawKits: unknown,
    presentation?: ScorePresentationDescriptor,
    status?: unknown,
  ): PresentedGameKits {
    const kits = decodeKits(rawKits);
    if (
      presentation?.visibility === 'active-match' &&
      !this.isActiveMatchStatus(status)
    ) {
      return { ...kits, score: null };
    }
    if (kits.score === null) return { ...kits, score: null };
    return {
      ...kits,
      score: {
        ...kits.score,
        label: presentation?.label ?? 'Scores',
        unit: presentation?.unit ?? { singular: 'point', plural: 'points' },
      },
    };
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isActiveMatchStatus(value: unknown): boolean {
    const status = this.stringValue(value).toLowerCase();
    return status === 'started' || status === 'playing';
  }

  private safeViewerId(value: unknown): number | null {
    const id = Number(value ?? 0);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}

function decodeKits(value: unknown): Record<string, unknown> & {
  score: ScorePlayerView | null;
} {
  const kits = asUnknownRecord(value);
  const score = asUnknownRecord(kits.score);
  if (Object.keys(score).length === 0) return { ...kits, score: null };
  const byPlayer = Object.fromEntries(
    Object.entries(asUnknownRecord(score.byPlayer)).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
  const leaderboard = (
    Array.isArray(score.leaderboard) ? score.leaderboard : []
  ).flatMap((value) => {
    const row = asUnknownRecord(value);
    return typeof row.playerId === 'number' &&
      typeof row.score === 'number' &&
      typeof row.rank === 'number'
      ? [{ playerId: row.playerId, score: row.score, rank: row.rank }]
      : [];
  });
  return { ...kits, score: { byPlayer, leaderboard } };
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
