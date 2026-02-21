import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import { CAT_PATTES_GAME } from '../definitions/game.definition';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_CARD_BY_ID } from '../model/cat-pattes-cards';
import { CAT_PATTES_GOAL } from '../model/cat-pattes-state.entity';

@Injectable()
export class CatPattesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CatPattesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const pending = this.normalizePending(state.pending as any, actions);
    const handIds = Array.isArray(meta.hands?.[userId])
      ? [...meta.hands[userId]]
      : [];
    const hand = handIds.map((id) => CAT_PATTES_CARD_BY_ID[id]?.name ?? id);

    const players = Array.isArray(state.players) ? state.players : [];
    const nameById: Record<number, string> = {};
    for (const p of players) {
      if (!p?.id) continue;
      nameById[p.id] =
        p?.username && String(p.username).trim()
          ? String(p.username).trim()
          : `Joueur ${p.id}`;
    }

    const scoreLines = players.map((p) => {
      const pid = p?.id;
      const name = nameById[pid] ?? `Joueur ${pid}`;
      const points = Number(meta.points?.[pid] ?? 0);
      return `${name} : ${points} points.`;
    });
    const progressionLines = players.map((p) => {
      const pid = p?.id;
      const name = nameById[pid] ?? `Joueur ${pid}`;
      const value = Number(meta.positions?.[pid] ?? 0);
      return `${name} : ${value} pattes / ${CAT_PATTES_GOAL}.`;
    });

    const handCounts = Object.entries(meta.hands ?? {})
      .map(
        ([id, cards]) =>
          `Joueur ${id}: ${Array.isArray(cards) ? cards.length : 0}`,
      )
      .join(' • ');

    const extras = {
      hand,
      handIds,
      hands: meta.hands,
      positions: meta.positions,
      points: meta.points,
      obstacles: meta.obstacles,
      bots: meta.bots,
      hasSun: meta.hasSun,
      pawns: meta.pawns,
      pawnByPlayerId: meta.pawnByPlayerId,
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: hand.length
              ? `Main : ${hand.join(', ')}`
              : 'Main : (vide)',
          },
          hands: {
            title: 'Mains',
            message: handCounts
              ? `Mains : ${handCounts}`
              : 'Mains : (inconnues)',
          },
          play: {
            title: 'À jouer',
            message:
              '(↑/↓ choisir, Entrée jouer, Espace piocher, C défausser, S score, P progression)',
          },
          score: {
            title: 'Score',
            message: scoreLines.join(' '),
          },
          position: {
            title: 'Progression',
            message: progressionLines.join(' '),
          },
        },
      },
    };

    return {
      ...state,
      catalog: {
        phases: CAT_PATTES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras,
      pending,
    } as any;
  }

  private normalizePending(
    pending: any,
    actions: Array<{ type?: string; payload?: Record<string, unknown> }>,
  ): any {
    if (!pending || typeof pending !== 'object') return pending ?? null;
    const type = String(pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (type !== 'choose_pawn') return pending;

    const rawChoices = Array.isArray(pending?.choices) ? pending.choices : [];
    const normalizedChoices = rawChoices
      .map((choice: unknown) => String(choice ?? '').trim())
      .filter((choice: string) => choice.length > 0);
    if (normalizedChoices.length > 0) {
      return {
        ...pending,
        choices: normalizedChoices,
      };
    }

    const pendingPawns = Array.isArray(pending?.data?.pawns)
      ? pending.data.pawns
      : [];
    const pawnsFromPendingData = pendingPawns
      .map((pawn: any) => String(pawn?.label ?? pawn?.id ?? '').trim())
      .filter((choice: string) => choice.length > 0);
    if (pawnsFromPendingData.length > 0) {
      return {
        ...pending,
        choices: pawnsFromPendingData,
      };
    }

    const pawnsFromActions = (Array.isArray(actions) ? actions : [])
      .filter(
        (action) =>
          String(action?.type ?? '')
            .trim()
            .toLowerCase() === 'choose_pawn',
      )
      .map((action) => {
        const payload = action?.payload ?? {};
        return String(
          payload.pawnId ?? payload.pawn ?? payload.value ?? '',
        ).trim();
      })
      .filter((choice) => choice.length > 0);
    if (pawnsFromActions.length > 0) {
      return {
        ...pending,
        choices: pawnsFromActions,
      };
    }

    return pending;
  }
}
