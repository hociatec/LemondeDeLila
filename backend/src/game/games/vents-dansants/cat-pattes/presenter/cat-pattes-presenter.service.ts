import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';

import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import * as Rulebook from '../rulebook/rulebook';
import { CAT_PATTES_GAME } from '../definitions/game.definition';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_CARD_BY_ID } from '../model/cat-pattes-cards';
import { CAT_PATTES_DEFAULT_ROUNDS } from '../model/cat-pattes-state.entity';
import { stringOrEmpty } from '@common/utils/string-value.utils';

@Injectable()
export class CatPattesPresenterService {
  private sanitizePlayerName(raw: unknown): string {
    return stringOrEmpty(raw).trim();
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as CatPattesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const roundsToPlay = (() => {
      const parsed = Number(meta.roundsToPlay ?? CAT_PATTES_DEFAULT_ROUNDS);
      if (!Number.isFinite(parsed)) return CAT_PATTES_DEFAULT_ROUNDS;
      const rounded = Math.round(parsed);
      if (rounded < 1 || rounded > 20) return CAT_PATTES_DEFAULT_ROUNDS;
      return rounded;
    })();
    const completedRounds = (() => {
      const parsed = Number(meta.completedRounds ?? 0);
      if (!Number.isFinite(parsed)) return 0;
      return Math.max(0, Math.trunc(parsed));
    })();
    const basePending = state.pending as any;
    const pendingForUser =
      basePending?.type === 'config_prompt' &&
      Number(basePending?.playerId ?? NaN) !== Number(userId)
        ? null
        : basePending;
    const pending = pendingForUser;
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
      return `${name} : ${points} pattes`;
    });
    const obstacleLabels: Record<string, string> = {
      gamelle: 'Gamelle vide',
      pluie: 'Pluie torrentielle',
      chien: 'Chien enragé',
      coussin: 'Coussin piégé',
      sol: 'Sol ciré',
    };
    const botLabels: Record<string, string> = {
      reserve: 'Reserve secrete',
      'chat-ninja': 'Chat ninja',
      'patte-blindee': 'Patte blindee',
      'passage-star': 'Passage de star',
    };
    const effectLines = players.map((p) => {
      const pid = p?.id;
      const name = nameById[pid] ?? `Joueur ${pid}`;
      const obstacle = meta.obstacles?.[pid] ?? null;
      const obstacleLabel = obstacle ? obstacleLabels[obstacle] : null;
      const bots = Array.isArray(meta.bots?.[pid]) ? meta.bots[pid] : [];
      const botNames = bots.map((b) => botLabels[b] ?? String(b));
      const status = obstacleLabel ? `arrêté par ${obstacleLabel}` : 'libre';
      const immunities = botNames.length
        ? `, immunités ${botNames.join(', ')}`
        : '';
      return `${name} : ${status}${immunities}.`;
    });

    const handCounts = Object.entries(meta.hands ?? {})
      .map(
        ([id, cards]) =>
          `Joueur ${id}: ${Array.isArray(cards) ? cards.length : 0}`,
      )
      .join(' • ');
    const lastDiscardId = Array.isArray(meta.discard)
      ? (meta.discard[meta.discard.length - 1] ?? null)
      : null;
    const lastDiscardName =
      lastDiscardId && CAT_PATTES_CARD_BY_ID[lastDiscardId]
        ? CAT_PATTES_CARD_BY_ID[lastDiscardId].name
        : null;

    const extras = {
      hand,
      handIds,
      positions: meta.positions,
      points: meta.points,
      roundsToPlay,
      completedRounds,
      obstacles: meta.obstacles,
      bots: meta.bots,
      hasSun: meta.hasSun,
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
              '(↑/↓ choisir, Entrée jouer, Espace piocher, D défausser, C dernière carte, S score, P progression, I infos)',
          },
          score: {
            title: 'Score',
            message: `${scoreLines.join(', ')}. Manches: ${Math.min(completedRounds, roundsToPlay)}/${roundsToPlay}.`,
          },
          discard: {
            title: 'Dernière carte',
            message: lastDiscardName
              ? `Dernière carte jouée : ${lastDiscardName}.`
              : 'Dernière carte jouée : (aucune).',
          },
          info: {
            title: 'Effets en cours',
            message: effectLines.length
              ? effectLines.join('\n')
              : 'Aucun effet actif.',
          },
        },
      },
    };

    return {
      ...state,
      log: this.redactDrawLogForUser(state.log as any, players as any, userId),
      catalog: {
        phases: CAT_PATTES_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions),
      extras,
      pending,
    } as any;
  }

  private redactDrawLogForUser(
    log: Array<{ message: string; timestamp?: string }> | undefined,
    players: Array<{ id: number; username?: string }>,
    userId: number,
  ): Array<{ message: string; timestamp?: string }> {
    if (!Array.isArray(log) || log.length === 0) {
      return Array.isArray(log) ? [...log] : [];
    }

    const normalize = (raw: unknown): string =>
      this.sanitizePlayerName(raw).toLowerCase();
    const idByLabel = new Map<string, number>();
    for (const p of players) {
      const name = this.sanitizePlayerName(p?.username);
      if (name) idByLabel.set(normalize(name), p.id);
      idByLabel.set(normalize(`joueur ${p.id}`), p.id);
    }

    const drawRe = /^(.+?) pioche (.+)\.$/;
    return log.map((entry) => {
      const message = String(entry?.message ?? '').trim();
      const match = message.match(drawRe);
      if (!match) return entry;

      const actorLabel = this.sanitizePlayerName(match[1]);
      const actorId = idByLabel.get(normalize(actorLabel)) ?? null;
      if (actorId === userId) return entry;

      return { ...entry, message: `${actorLabel} pioche une carte.` };
    });
  }
}
