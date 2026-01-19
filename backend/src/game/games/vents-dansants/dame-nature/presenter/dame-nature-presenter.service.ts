import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { DAME_NATURE_PHASES } from '../definitions/rules.definition';
import { DAME_NATURE_VICTORY } from '../definitions/victory.definition';
import { DameNatureSetupService } from '../setup/dame-nature-setup.service';
import type {
  FamilyCard,
  DameNatureMetadata,
} from '../model/dame-nature.model';
import * as DameNatureRulebook from '../rulebook/rulebook';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';

@Injectable()
export class DameNaturePresenterService extends BasePresenterService {
  constructor(private readonly setup: DameNatureSetupService) {
    super();
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const exposed = this.buildExposedState(state);
    const meta = this.getMetadata(state) as DameNatureMetadata;
    const currentId = this.getCurrentPlayerId(state);
    const pollution =
      (meta?.pollutionByPlayer ?? {})[String(currentId ?? '')] ?? 0;

    return {
      ...exposed,
      metadata: {
        ...(state.metadata as any),
        pollution,
        pollutionByPlayer: undefined,
      },
    };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const exposed = this.buildExposedStateForUser(state, userId);
    const meta = this.getMetadata(state) as DameNatureMetadata;
    const pollution =
      (meta?.pollutionByPlayer ?? {})[String(userId ?? '')] ?? 0;

    return {
      ...exposed,
      metadata: {
        ...(state.metadata as any),
        pollution,
        pollutionByPlayer: undefined,
      },
    };
  }

  // ============================================================================
  // Méthodes de template (implémentation de BasePresenterService)
  // ============================================================================

  protected buildCatalog(): { phases: string[]; victory: any } {
    return {
      phases: DAME_NATURE_PHASES.map((p) => p.id),
      victory: DAME_NATURE_VICTORY,
    };
  }

  protected getAvailableActions(
    state: GameStateEntity,
    currentPlayerId: number | null,
  ): GameSingleActionDto[] {
    const meta = this.getMetadata(state) as DameNatureMetadata;
    const pendingAsk = meta?.pendingAsk ?? null;
    const pendingQuiz = meta?.pendingQuiz ?? null;
    const actionPlayerId =
      pendingAsk?.targetId ??
      pendingQuiz?.playerId ??
      (typeof currentPlayerId === 'number' ? currentPlayerId : null);

    return typeof actionPlayerId === 'number'
      ? DameNatureRulebook.getAvailableActions(
          { ...state, players: this.setup.ensurePlayers(state) as any },
          actionPlayerId,
        )
      : [];
  }

  protected buildPendingState(
    state: GameStateEntity,
    metadata: DameNatureMetadata,
    currentPlayerId: number | null,
  ): any {
    const pendingAsk = metadata?.pendingAsk ?? null;
    const pendingQuiz = metadata?.pendingQuiz ?? null;
    const actionPlayerId =
      pendingAsk?.targetId ??
      pendingQuiz?.playerId ??
      (typeof currentPlayerId === 'number' ? currentPlayerId : null);

    if (pendingQuiz) {
      return {
        type: 'quiz',
        label: 'Réponses possibles',
        question:
          pendingQuiz.card?.question ?? pendingQuiz.card?.memberName ?? 'Quiz',
        choices: pendingQuiz.card?.choices ?? [
          'Bonne réponse',
          'Mauvaise réponse',
        ],
        playerId: pendingQuiz.playerId,
      };
    }

    if (pendingAsk) {
      return {
        type: 'ask_card',
        playerId: pendingAsk.fromId,
        targetPlayerId: pendingAsk.targetId,
        blocking: true,
      };
    }

    return null;
  }

  protected buildExtras(
    state: GameStateEntity,
    metadata: DameNatureMetadata,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const buildListMessage = (title: string, itemsRaw: unknown) => {
      const items = Array.isArray(itemsRaw)
        ? itemsRaw.map((x) => String(x ?? '').trim()).filter((x) => x)
        : [];

      if (items.length === 0) return `${title}: (vide)`;

      const max = 12;
      const shown = items.length > max ? items.slice(0, max) : items;
      const body = shown.join(', ');
      return items.length > max
        ? `${title}: ${body}, ... (+${items.length - max})`
        : `${title}: ${body}`;
    };

    const baseExtras = this.getBaseExtras(state);
    const started = this.isStarted(state);
    const players = this.setup.ensurePlayers(state) as any[];
    const playerViews = this.buildPlayerViews(
      state,
      players,
      currentPlayerId,
      started,
    );
    const currentPlayerView =
      typeof currentPlayerId === 'number'
        ? (playerViews.find((v) => v.id === currentPlayerId) ?? null)
        : null;
    const handCards = this.buildHandCards(
      players,
      currentPlayerId,
      started,
      currentPlayerView,
    );

    const pollution =
      started && typeof currentPlayerId === 'number'
        ? ((metadata?.pollutionByPlayer ?? {})[String(currentPlayerId)] ?? 0)
        : 0;
    const maxPollution = metadata?.maxPollution ?? 0;
    const goal = metadata?.familyGoal ?? 0;
    const booksCount = currentPlayerView?.books?.length ?? 0;
    const score = started
      ? [
          `Pollution: ${pollution}/${maxPollution}`,
          `Familles: ${booksCount}/${goal}`,
        ]
      : [];

    return {
      ...baseExtras,
      catalog: this.buildFamiliesCatalog(),
      playerViews,
      currentPlayerView,
      hand: started ? (currentPlayerView?.hand ?? []) : [],
      handCards,
      books: started ? (currentPlayerView?.books ?? []) : [],
      score,
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: buildListMessage('Main', started ? (currentPlayerView?.hand ?? []) : []),
          },
          books: {
            title: 'Familles',
            message: buildListMessage('Familles', started ? (currentPlayerView?.books ?? []) : []),
          },
          score: {
            title: 'Score',
            message: buildListMessage('Score', score),
          },
          pollution: {
            title: 'Pollution',
            message: started
              ? `Pollution: ${pollution}/${maxPollution}.`
              : 'Pollution: inconnue.',
          },
        },
      },
      pendingAsk: metadata?.pendingAsk ?? null,
      pendingQuiz: metadata?.pendingQuiz ?? null,
    };
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: DameNatureMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const buildListMessage = (title: string, itemsRaw: unknown) => {
      const items = Array.isArray(itemsRaw)
        ? itemsRaw.map((x) => String(x ?? '').trim()).filter((x) => x)
        : [];

      if (items.length === 0) return `${title}: (vide)`;

      const max = 12;
      const shown = items.length > max ? items.slice(0, max) : items;
      const body = shown.join(', ');
      return items.length > max
        ? `${title}: ${body}, ... (+${items.length - max})`
        : `${title}: ${body}`;
    };

    const baseExtras = this.getBaseExtras(state);
    const started = this.isStarted(state);
    const players = this.setup.ensurePlayers(state) as any[];
    const playerViews = this.buildPlayerViewsForUser(
      state,
      players,
      userId,
      started,
    );
    const viewerView =
      typeof userId === 'number'
        ? (playerViews.find((v) => v.id === userId) ?? null)
        : null;
    const currentPlayerView =
      currentPlayerId !== null
        ? (playerViews.find((v) => v.id === currentPlayerId) ?? null)
        : null;
    const viewerPlayer =
      typeof userId === 'number'
        ? (players.find((p) => p.id === userId) ?? null)
        : null;
    const handCards = this.buildHandCardsForUser(viewerPlayer, started);

    const pollution =
      started && typeof userId === 'number'
        ? ((metadata?.pollutionByPlayer ?? {})[String(userId)] ?? 0)
        : 0;
    const maxPollution = metadata?.maxPollution ?? 0;
    const goal = metadata?.familyGoal ?? 0;
    const booksCount = viewerView?.books?.length ?? 0;
    const score = started
      ? [
          `Pollution: ${pollution}/${maxPollution}`,
          `Familles: ${booksCount}/${goal}`,
        ]
      : [];

    return {
      ...baseExtras,
      catalog: this.buildFamiliesCatalog(),
      playerViews,
      currentPlayerView,
      hand: started ? (viewerView?.hand ?? []) : [],
      handCards,
      books: started ? (viewerView?.books ?? []) : [],
      score,
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: buildListMessage('Main', started ? (viewerView?.hand ?? []) : []),
          },
          books: {
            title: 'Familles',
            message: buildListMessage('Familles', started ? (viewerView?.books ?? []) : []),
          },
          score: {
            title: 'Score',
            message: buildListMessage('Score', score),
          },
          pollution: {
            title: 'Pollution',
            message: started
              ? `Pollution: ${pollution}/${maxPollution}.`
              : 'Pollution: inconnue.',
          },
        },
      },
      pendingAsk: metadata?.pendingAsk ?? null,
      pendingQuiz: metadata?.pendingQuiz ?? null,
    };
  }

  // ============================================================================
  // Méthodes utilitaires privées
  // ============================================================================

  private buildPlayerViews(
    state: GameStateEntity,
    players: any[],
    currentPlayerId: number | null,
    started: boolean,
  ): any[] {
    const families = this.setup.families();
    const familyLabel = (familyId: string) =>
      families.find((f) => f.id === familyId)?.name ?? familyId;
    const handLabel = (card: FamilyCard) =>
      `${familyLabel(card.familyId)} - ${card.memberName}`;

    return players.map((p) => {
      const isCurrent = currentPlayerId != null && p.id === currentPlayerId;
      return {
        id: p.id,
        username: p.username,
        hand: started && isCurrent ? (p.hand ?? []).map(handLabel) : [],
        books: started && isCurrent ? (p.books ?? []).map(familyLabel) : [],
        handCount: p.handCount ?? (p.hand ?? []).length,
        booksCount: (p.books ?? []).length,
      };
    });
  }

  private buildPlayerViewsForUser(
    state: GameStateEntity,
    players: any[],
    userId: number,
    started: boolean,
  ): any[] {
    const families = this.setup.families();
    const familyLabel = (familyId: string) =>
      families.find((f) => f.id === familyId)?.name ?? familyId;
    const handLabel = (card: FamilyCard) =>
      `${familyLabel(card.familyId)} - ${card.memberName}`;

    return players.map((p) => {
      const isViewer = typeof userId === 'number' && p.id === userId;
      return {
        id: p.id,
        username: p.username,
        hand: started && isViewer ? (p.hand ?? []).map(handLabel) : [],
        books: started && isViewer ? (p.books ?? []).map(familyLabel) : [],
        handCount: p.handCount ?? (p.hand ?? []).length,
        booksCount: (p.books ?? []).length,
      };
    });
  }

  private buildHandCards(
    players: any[],
    currentPlayerId: number | null,
    started: boolean,
    currentPlayerView: any,
  ): any[] {
    if (!started || !currentPlayerView || currentPlayerId == null) {
      return [];
    }

    const families = this.setup.families();
    const familyLabel = (familyId: string) =>
      families.find((f) => f.id === familyId)?.name ?? familyId;
    const handLabel = (card: FamilyCard) =>
      `${familyLabel(card.familyId)} - ${card.memberName}`;

    return (
      players
        .find((p) => p.id === currentPlayerId)
        ?.hand?.map((c: FamilyCard) => ({
          familyId: c.familyId,
          memberId: c.memberId,
          label: handLabel(c),
        })) ?? []
    );
  }

  private buildHandCardsForUser(viewerPlayer: any, started: boolean): any[] {
    if (!started || !viewerPlayer) {
      return [];
    }

    const families = this.setup.families();
    const familyLabel = (familyId: string) =>
      families.find((f) => f.id === familyId)?.name ?? familyId;
    const handLabel = (card: FamilyCard) =>
      `${familyLabel(card.familyId)} - ${card.memberName}`;

    return (
      viewerPlayer?.hand?.map((c: FamilyCard) => ({
        familyId: c.familyId,
        memberId: c.memberId,
        label: handLabel(c),
      })) ?? []
    );
  }

  private buildFamiliesCatalog(): Record<
    string,
    { id: string; name: string }[]
  > {
    return this.setup.families().reduce(
      (acc, f) => ({
        ...acc,
        [f.id]: f.members.map((m) => ({ id: m.id, name: m.name })),
      }),
      {} as Record<string, { id: string; name: string }[]>,
    );
  }
}
