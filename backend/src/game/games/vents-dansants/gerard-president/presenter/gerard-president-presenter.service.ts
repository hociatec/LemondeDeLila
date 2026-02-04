import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as Rulebook from '../rulebook/rulebook';
import type { GerardPresidentMetadata } from '../model/gerard-president-state.entity';
import {
  GERARD_PRESIDENT_NAMES,
  GERARD_PRESIDENT_SPECIAL_CARDS,
  GERARD_PRESIDENT_THEMES,
} from '../model/gerard-president-cards';

const ACTION_LABELS: Record<string, string> = {
  set_theme: 'Définir un thème',
  play_name: 'Jouer un prénom',
  play_special: 'Jouer une carte spéciale',
  pass: 'Passer',
  choose_winner: 'Choisir le gagnant',
};

@Injectable()
export class GerardPresidentPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const metadata = (state.metadata ?? {}) as GerardPresidentMetadata;
    const submissions = metadata.submissions ?? {};
    const sanitizedSubmissions = this.sanitizeSubmissions(submissions, userId);
    const hand = metadata.hands?.[userId] ?? [];
    const specialHand = metadata.specialHands?.[userId] ?? [];
    const handCounts = this.buildHandCounts(metadata.hands);
    const isMaster = metadata.masterId === userId;
    const themeHidden =
      metadata.themeSecretActive && metadata.masterId != null && !isMaster;
    const currentTheme = themeHidden ? 'Thème secret' : metadata.currentTheme;
    const secondTheme =
      themeHidden && metadata.secondTheme ? 'Thème secret' : metadata.secondTheme;
    const actions = Rulebook.getAvailableActions(state, userId);
    const catalog = this.buildCatalog();
    const extras = {
      hand,
      specialHand,
      handCards: this.buildHandCards(hand, specialHand),
      handCounts,
      playerViews: this.buildPlayerViews(state.players),
      submissions: metadata.juryOverrideId
        ? this.markJuryOverride(sanitizedSubmissions, metadata.juryOverrideId)
        : sanitizedSubmissions,
      scores: metadata.scores,
      roundPhase: metadata.roundPhase,
      targetScore: metadata.targetScore,
      pendingPlayers: metadata.pendingPlayers,
    };

    return {
      ...state,
      metadata: {
        ...metadata,
        currentTheme,
        secondTheme,
        hands: { [userId]: [...hand] },
        specialHands: { [userId]: [...specialHand] },
        submissions: sanitizedSubmissions,
      },
      catalog,
      actions: actions.map((action) => ({
        type: action.type,
        label: ACTION_LABELS[action.type] ?? action.type,
        payload: action.payload ?? {},
      })),
      extras,
      pending: state.pending ?? null,
    } as GameStateWithActions;
  }

  private sanitizeSubmissions(
    submissions: Record<number, string[]>,
    viewerId: number,
  ): Record<number, string[]> {
    const sanitized: Record<number, string[]> = {};
    Object.entries(submissions).forEach(([key, names]) => {
      const playerId = Number(key);
      if (playerId === viewerId) {
        sanitized[playerId] = [...(names ?? [])];
      } else {
        sanitized[playerId] = (names ?? []).map(() => 'Prénom secret');
      }
    });
    return sanitized;
  }

  private markJuryOverride(
    submissions: Record<number, string[]>,
    juryId: number,
  ): Record<number, string[]> {
    if (!submissions[juryId]) {
      return submissions;
    }
    return {
      ...submissions,
      [juryId]: submissions[juryId].map((name) => `${name} (jury)`),
    };
  }

  private buildHandCounts(
    hands?: Record<number, string[]>,
  ): Record<number, number> {
    const counts: Record<number, number> = {};
    Object.entries(hands ?? {}).forEach(([key, values]) => {
      const playerId = Number(key);
      if (!Number.isFinite(playerId)) return;
      counts[playerId] = Array.isArray(values) ? values.length : 0;
    });
    return counts;
  }

  private buildCatalog(): Record<string, unknown> {
    return {
      phases: ['round'],
      victory: null,
      names: GERARD_PRESIDENT_NAMES.map((name, index) => ({
        id: `name-${index}`,
        name,
      })),
      specials: GERARD_PRESIDENT_SPECIAL_CARDS.map((card) => ({
        id: card.id,
        name: card.name,
        label: card.description,
      })),
      themes: GERARD_PRESIDENT_THEMES.map((theme, index) => ({
        id: `theme-${index}`,
        name: theme,
      })),
    } as any;
  }

  private buildHandCards(
    hand: string[],
    specialHand: string[],
  ): Array<{ familyId?: string; memberId: string; label: string }> {
    const cards = [
      ...hand.map((card) => ({ familyId: 'name', memberId: card, label: card })),
      ...specialHand.map((cardId) => {
        const special = GERARD_PRESIDENT_SPECIAL_CARDS.find((card) => card.id === cardId);
        const label = special ? `${special.name} – ${special.description}` : cardId;
        return { familyId: 'special', memberId: cardId, label };
      }),
    ];
    return cards;
  }

  private buildPlayerViews(
    players?: GameStateEntity['players'],
  ): Array<{ id: number; username: string }> {
    if (!Array.isArray(players)) return [];
    return players
      .filter((player) => typeof player?.id === 'number')
      .map((player) => ({
        id: player!.id,
        username:
          player?.username?.trim() || `Joueur ${player!.id}`,
      }));
  }
}
