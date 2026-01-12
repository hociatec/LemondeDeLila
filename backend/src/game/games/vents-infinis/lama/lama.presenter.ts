import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import type { LamaCardValue, LamaMetadata } from './model/lama.model';
import { lamaCardLabel, lamaCardScore, nextLamaValue, LAMA_VALUE } from './model/lama.model';

@Injectable()
export class LamaPresenter extends BasePresenterService {
  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.buildExposedStateForUser(state, userId);
  }

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['round'], victory: { type: 'lowest_score' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    if (!this.isStarted(state)) return [];

    const meta = (state.metadata ?? {}) as LamaMetadata;
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== userId) return [];

    const step = meta.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== userId) return [];
      const score = Number((meta.scoresByPlayerId ?? {})[String(userId)] ?? 0);
      const out: GameSingleActionDto[] = [];
      if (score >= 1) out.push({ type: 'lama_return', payload: { value: 1 } });
      if (score >= 10) out.push({ type: 'lama_return', payload: { value: 10 } });
      out.push({ type: 'lama_return', payload: { value: 0 } });
      return out;
    }

    const hand = (meta.handsByPlayerId ?? {})[String(userId)] ?? [];
    const droppedOut = Boolean((meta.droppedOutByPlayerId ?? {})[String(userId)]);
    if (droppedOut) return [];

    const top = this.topDiscard(meta);
    if (!top) return [];

    const playable = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const out: GameSingleActionDto[] = [];

    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (!playable.has(value)) continue;
      for (let c = 1; c <= count; c += 1) {
        out.push({
          type: 'lama_play',
          payload: { value, count: c },
        });
      }
    }

    if ((meta.deck ?? []).length > 0) {
      out.push({ type: 'draw', payload: {} });
    }
    out.push({ type: 'lama_quit', payload: {} });
    return out;
  }

  protected buildPendingState(
    _state: GameStateEntity,
    _metadata: LamaMetadata,
    _currentPlayerId: number | null,
  ): any {
    return null;
  }

  protected buildPendingStateForUser(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): any {
    if (!this.isStarted(state)) return null;
    if (currentPlayerId !== userId) return null;

    const step = metadata.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (metadata.pendingReturnPlayerId !== userId) return null;
      const score = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
      const choices: string[] = [];
      if (score >= 1) choices.push('Retirer 1 point');
      if (score >= 10) choices.push('Retirer 10 points');
      choices.push("Ne rien retirer");
      return {
        type: 'lama_return',
        label: 'Vous avez fini le round avec 0 carte : retirez des points.',
        playerId: userId,
        choices,
      };
    }

    const hand = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
    const droppedOut = Boolean((metadata.droppedOutByPlayerId ?? {})[String(userId)]);
    if (droppedOut) return null;

    const top = this.topDiscard(metadata);
    if (!top) return null;

    const playable = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const choices: string[] = [];
    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (!playable.has(value)) continue;
      for (let c = 1; c <= count; c += 1) {
        choices.push(`Jouer ${lamaCardLabel(value)} ×${c}`);
      }
    }
    if ((metadata.deck ?? []).length > 0) {
      choices.push('Piocher');
    }
    choices.push('Sortir du round');

    const meScore = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
    const deckCount = (metadata.deck ?? []).length;
    const discardTop = lamaCardLabel(top);
    const handScore = (hand as LamaCardValue[]).reduce((sum, v) => sum + lamaCardScore(v), 0);
    return {
      type: 'lama_turn',
      label: `Défausse: ${discardTop}. Main: ${hand.length} cartes (${handScore} pts). Score total: ${meScore}. Pioche: ${deckCount}.`,
      playerId: userId,
      choices,
    };
  }

  protected getActionLabel(actionType: string): string {
    if (actionType === 'lama_play') return 'Jouer';
    if (actionType === 'draw') return 'Piocher';
    if (actionType === 'lama_quit') return 'Sortir';
    if (actionType === 'lama_return') return 'Retirer points';
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
    _metadata: LamaMetadata,
    _userId: number,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  private topDiscard(meta: LamaMetadata): LamaCardValue | null {
    const discard = meta.discard ?? [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return null;
    if (top < 1 || top > LAMA_VALUE) return null;
    return top as LamaCardValue;
  }
}

