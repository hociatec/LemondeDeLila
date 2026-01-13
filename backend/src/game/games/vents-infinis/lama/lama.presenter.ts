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

  private isSetup(state: GameStateEntity): boolean {
    return String(state?.status ?? '').toLowerCase() === 'setup';
  }

  private setupOptions(): number[] {
    // Kept short for easier navigation; can be extended later if needed.
    return [20, 30, 40, 50, 60, 70, 80];
  }

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['round'], victory: { type: 'lowest_score' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    const meta = (state.metadata ?? {}) as LamaMetadata;

    if (this.isSetup(state) || (meta.step ?? '') === 'setup_target') {
      const ownerId = meta.ownerPlayerId ?? null;
      if (ownerId == null || userId !== ownerId) return [];
      return this.setupOptions().map((loseAtScore) => ({
        type: 'lama_set_target',
        payload: { loseAtScore },
      }));
    }

    if (!this.isStarted(state)) return [];

    const out: GameSingleActionDto[] = [
      { type: 'lama_peek_discard', payload: {} },
      { type: 'lama_peek_deck', payload: {} },
    ];

    const current = state.turn?.currentPlayerId ?? null;
    if (current !== userId) return out;

    const step = meta.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== userId) return [];
      const score = Number((meta.scoresByPlayerId ?? {})[String(userId)] ?? 0);
      if (score >= 1) out.push({ type: 'lama_return', payload: { value: 1 } });
      if (score >= 10) out.push({ type: 'lama_return', payload: { value: 10 } });
      out.push({ type: 'lama_return', payload: { value: 0 } });
      return out;
    }

    const hand = (meta.handsByPlayerId ?? {})[String(userId)] ?? [];

    const top = this.topDiscard(meta);
    if (!top) return out;

    const playable = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (!playable.has(value)) continue;
      if (count > 0) {
        out.push({
          type: 'lama_play',
          payload: { value, count: 1 },
        });
      }
    }

    if ((meta.deck ?? []).length > 0) {
      out.push({ type: 'draw', payload: {} });
    }
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
    if (this.isSetup(state) || (metadata.step ?? '') === 'setup_target') {
      const ownerId = metadata.ownerPlayerId ?? null;
      if (ownerId == null || userId !== ownerId) return null;
      return {
        type: 'lama_setup',
        label: 'Choisissez le score de défaite (↑/↓ puis Entrée).',
        playerId: ownerId,
        choices: this.setupOptions().map(String),
      };
    }

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
        label: 'Vous avez gagné le round : retirez 1 point (jeton) ou 10 points (diamant).',
        playerId: userId,
        choices,
      };
    }

    const hand = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];

    const top = this.topDiscard(metadata);
    if (!top) return null;

    const next = nextLamaValue(top);
    const playable = new Set<LamaCardValue>([top, next]);
    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const choices: string[] = [];
    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (!playable.has(value)) continue;
      if (count > 0) {
        // Pending choices should be the list navigated with ↑/↓: only playable cards from the hand.
        choices.push(lamaCardLabel(value));
      }
    }

    const meScore = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
    const deckCount = (metadata.deck ?? []).length;
    const discardTop = lamaCardLabel(top);
    const playableRule = `Vous pouvez jouer ${discardTop} ou ${lamaCardLabel(next)}.`;
    const handScore = [...new Set(hand as LamaCardValue[])].reduce(
      (sum, v) => sum + lamaCardScore(v),
      0,
    );
    return {
      type: 'lama_turn',
      label: `Défausse: ${discardTop}. ${playableRule} Main: ${hand.length} cartes (${handScore} pts). Score total: ${meScore}. Pioche: ${deckCount}. (↑/↓ choisir une carte, Entrée jouer, Espace piocher, C voir défausse, E voir pioche)`,
      playerId: userId,
      choices,
    };
  }

  protected getActionLabel(actionType: string): string {
    if (actionType === 'lama_play') return 'Jouer';
    if (actionType === 'draw') return 'Piocher';
    if (actionType === 'lama_set_target') return 'Score de défaite';
    if (actionType === 'lama_return') return 'Retirer points';
    if (actionType === 'lama_peek_discard') return 'Voir défausse';
    if (actionType === 'lama_peek_deck') return 'Voir pioche';
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
    const base = this.getBaseExtras(state);
    const players = Array.isArray(state.players) ? state.players : [];

    const handValues = ((metadata.handsByPlayerId ?? {})[String(userId)] ?? []) as LamaCardValue[];
    const hand = handValues.map(lamaCardLabel);

    const scoreBy = metadata.scoresByPlayerId ?? {};
    const myScore = Number(scoreBy[String(userId)] ?? 0);
    const scoreLines = players
      .filter((p) => p?.id)
      .map((p) => {
        const pid = p.id;
        const s = Number(scoreBy[String(pid)] ?? 0);
        const name = p.username ?? `#${pid}`;
        return `${name}: ${s}`;
      });

    const discard = Array.isArray(metadata.discard) ? metadata.discard : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    const discardTop = top ? lamaCardLabel(top as LamaCardValue) : '(vide)';
    const discardNext =
      top != null ? lamaCardLabel(nextLamaValue(top as LamaCardValue)) : '(inconnu)';

    const deckCount = (metadata.deck ?? []).length;

    const playableText = (() => {
      if (this.isSetup(state)) {
        const loseAt = metadata.loseAtScore ?? null;
        return loseAt != null
          ? `Réglages: défaite à ${loseAt} points.`
          : 'Réglages: choisissez le score de défaite, puis Entrée.';
      }
      if (!this.isStarted(state)) return 'Partie non démarrée.';
      if (currentPlayerId !== userId) return "Ce n'est pas votre tour.";
      const step = metadata.step ?? 'turn_choice';
      if (step === 'return_token') return 'Retirez des points (1 ou 10) si possible.';
      if (!top) return 'Défausse vide.';
      const allowed = new Set<LamaCardValue>([top as LamaCardValue, nextLamaValue(top as LamaCardValue)]);
      const counts = new Map<LamaCardValue, number>();
      for (const v of handValues) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
        if (!allowed.has(value)) continue;
        parts.push(`${lamaCardLabel(value)}×${count}`);
      }
      const list = parts.length ? parts.join(', ') : '(aucune carte jouable)';
      return `Défausse: ${discardTop}. Règle: jouer ${discardTop} ou ${discardNext}. Jouables dans votre main: ${list}. (↑/↓ choisir une carte, Entrée jouer, Espace piocher, C défausse, E pioche)`;
    })();

    return {
      ...base,
      hand,
      score: [`Total: ${myScore}`, ...scoreLines],
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: hand.length ? `Main: ${hand.join(', ')}` : 'Main: (vide)',
          },
          discard: {
            title: 'Défausse',
            message: `Défausse: ${discardTop}. Jouable aussi: ${discardNext}. Pioche: ${deckCount}.`,
          },
          play: {
            title: 'À jouer',
            message: playableText,
          },
          score: {
            title: 'Score',
            message: scoreLines.length ? `Score: ${scoreLines.join(', ')}` : 'Score: inconnu.',
          },
          table: {
            title: 'Table',
            message:
              metadata.loseAtScore != null
                ? `Défaite à ${metadata.loseAtScore} points.`
                : 'Défaite: non configurée.',
          },
        },
      },
    };
  }

  private topDiscard(meta: LamaMetadata): LamaCardValue | null {
    const discard = meta.discard ?? [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return null;
    if (top < 1 || top > LAMA_VALUE) return null;
    return top as LamaCardValue;
  }
}
