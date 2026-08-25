import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { PendingState } from '../../../../../core/application/models/game-state.model';
import { BasePresenterService } from '../../../../../core/application/services/base-presenter.service';
import type { LamaMetadata } from '../../model/lama.model';
import { stringOrEmpty } from '@common/utils/public-api';
import { LamaActionsPresenter } from './lama-actions.presenter';
import { LamaExtrasPresenter } from './lama-extras.presenter';
import { LamaPendingPresenter } from './lama-pending.presenter';

export class LamaPresenter extends BasePresenterService {
  private readonly actionsPresenter = new LamaActionsPresenter();
  private readonly extrasPresenter = new LamaExtrasPresenter();
  private readonly pendingPresenter = new LamaPendingPresenter();

  private normalizeUiText(value: unknown): string {
    return stringOrEmpty(value)
      .replaceAll('Dé', 'Dé')
      .replaceAll('Dé', 'Dé')
      .replaceAll('dé', 'dé')
      .replaceAll('dé', 'dé')
      .replaceAll('é', 'é')
      .replaceAll('é', 'é')
      .replaceAll('è', 'è')
      .replaceAll('è', 'è')
      .replaceAll('ê', 'ê')
      .replaceAll('ê', 'ê')
      .replaceAll('à', 'à')
      .replaceAll('à', 'à')
      .replaceAll('↑', '↑')
      .replaceAll('↓', '↓');
  }

  private sanitizePlayerName(raw: unknown): string {
    let name = stringOrEmpty(raw).trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const exposed = this.buildExposedStateForUser(state, userId);
    // The internal game log contains the drawn card label. We redact it for opponents,
    // while still letting the drawing player see what they drew.
    const players = Array.isArray(state.players) ? state.players : [];
    const log = this.redactDrawLogForUser(exposed.log, players, userId);
    const pending =
      exposed.pending && typeof exposed.pending === 'object'
        ? {
            ...exposed.pending,
            label: this.normalizeUiText(exposed.pending.label ?? ''),
          }
        : exposed.pending;
    const actions = Array.isArray(exposed.actions)
      ? exposed.actions.map((action) => ({
          ...action,
          label:
            typeof action?.label === 'string'
              ? this.normalizeUiText(action.label)
              : action?.label,
        }))
      : exposed.actions;
    return { ...exposed, log, pending, actions };
  }

  protected buildCatalog(): {
    phases: string[];
    victory: Record<string, unknown>;
  } {
    return { phases: ['round'], victory: { type: 'lowest_score' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    return this.actionsPresenter.build(state, userId);
  }

  protected buildPendingState(
    _state: GameStateEntity,
    _metadata: LamaMetadata,
    _currentPlayerId: number | null,
  ): PendingState | null {
    return null;
  }

  protected buildPendingStateForUser(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): PendingState | null {
    return this.pendingPresenter.build(
      state,
      metadata,
      userId,
      currentPlayerId,
    );
  }

  protected getActionLabel(actionType: string): string {
    if (actionType === 'lama_play') return 'Jouer';
    if (actionType === 'draw') return 'Piocher';
    if (actionType === 'lama_set_config') return 'Configuration';
    if (actionType === 'lama_quit') return 'Se retirer de la manche';
    if (actionType === 'lama_pass') return 'Passer (fin du tour)';
    if (actionType === 'lama_return') return 'Rendre jetons';
    if (actionType === 'lama_peek_discard') return 'Voir défausse';
    if (actionType === 'lama_preview') return 'Voir carte';
    return actionType;
  }

  protected buildExtras(
    state: GameStateEntity,
    _metadata: LamaMetadata,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const actions = this.actionsPresenter.build(state, userId);
    return this.extrasPresenter.build(
      state,
      metadata,
      userId,
      currentPlayerId,
      this.getBaseExtras(state),
      actions,
    );
  }

  private redactDrawLogForUser(
    log: Array<{ message: string; timestamp?: string }> | undefined,
    players: Array<{ id: number; username?: string }>,
    userId: number,
  ): Array<{ message: string; timestamp?: string }> {
    if (!Array.isArray(log) || log.length === 0)
      return Array.isArray(log) ? [...log] : [];

    const normalize = (raw: unknown): string => this.sanitizePlayerName(raw);
    const keyOf = (raw: unknown): string => normalize(raw).toLowerCase();

    // Build the same label mapping as the game uses when logging actions.
    const idByLabel = new Map<string, number>();
    for (const p of players) {
      const name = normalize(p?.username);
      if (name) idByLabel.set(keyOf(name), p.id);
      idByLabel.set(keyOf(`joueur ${p.id}`), p.id);
    }

    const viewerName = players.find((p) => p?.id === userId)?.username ?? '';
    const viewerKeys = new Set(
      [keyOf(viewerName), keyOf(`joueur ${userId}`)].filter(
        (k) => k.length > 0,
      ),
    );

    const drawRe = /^(.+?) pioche un (.+)\.$/;

    return log.map((entry) => {
      const msg = String(entry?.message ?? '').trim();
      const m = msg.match(drawRe);
      if (!m) return entry;

      const actorLabel = normalize(m[1]);
      const actorKey = keyOf(actorLabel);
      const actorId = idByLabel.get(actorKey) ?? null;

      // Keep the full info for the drawing player (even if ids mismatch, use label as fallback).
      if (actorId === userId || (actorKey && viewerKeys.has(actorKey)))
        return entry;

      return { ...entry, message: `${actorLabel} pioche une carte.` };
    });
  }
}
