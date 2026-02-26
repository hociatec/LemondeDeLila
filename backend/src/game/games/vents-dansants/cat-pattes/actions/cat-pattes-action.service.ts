import { Injectable, Optional } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { PromptPoliciesService } from '../../../../modules/prompt-policies/services/prompt-policies.service';
import { resolvePendingPawnChoiceAction } from '../../../../core/helpers/pawn-choice-action.helper';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesBotType,
  CatPattesCardDefinition,
  CatPattesObstacleType,
  CatPattesParadeType,
} from '../model/cat-pattes-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_GOAL } from '../model/cat-pattes-state.entity';
import {
  CAT_PATTES_OBSTACLE_TO_PARADE,
  canPlayPattes,
  playerCanReceiveObstacle,
} from '../rulebook/rulebook';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  pawnId?: string | null;
  pawn?: string | null;
  value?: string | null;
  goalPattes?: number | null;
};

const OBSTACLE_LABELS: Record<CatPattesObstacleType, string> = {
  gamelle: 'Gamelle vide',
  pluie: 'Pluie torrentielle',
  chien: 'Chien enragé',
  coussin: 'Coussin piégé',
  sol: 'Sol ciré',
};

const PARADE_LABELS: Record<CatPattesParadeType, string> = {
  croquettes: 'Croquettes',
  rayon: 'Rayon de soleil',
  dodo: 'Dodo réparateur',
  coussin: 'Nouveau coussin',
  saut: 'Saut agile',
};

const BOT_EFFECTS: Record<CatPattesBotType, string> = {
  reserve: 'Ignore Gamelle vide.',
  'chat-ninja': 'Ignore Chien enragé.',
  'patte-blindee': 'Ignore Coussin piégé.',
  'passage-star':
    'Ignore Pluie torrentielle et Sol ciré, et permet de jouer sans soleil.',
};

const OBSTACLE_IMPACTS: Record<CatPattesObstacleType, string> = {
  gamelle:
    "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
  pluie:
    "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
  chien:
    "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
  coussin:
    "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
  sol: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
};

@Injectable()
export class CatPattesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly setupFlow: SetupFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly random: RandomService,
    @Optional() private readonly turnPolicies?: TurnPoliciesService,
    @Optional() _promptPolicies?: PromptPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(
      this.ensurePawnSelectionPrompt(state),
      actions,
      (next, action) => {
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            choose_pawn: () => {
              next = this.handleChoosePawn(next, action);
              next = this.ensurePawnSelectionPrompt(next);
              return next;
            },
            draw: () => {
              next = this.handleDraw(next);
              return next;
            },
            play_card: () => {
              next = this.handlePlayCard(next, action);
              return next;
            },
            cat_pattes_set_config: () => {
              next = this.handleSetConfig(next, action);
              return next;
            },
            discard_card: () => {
              next = this.handleDiscard(next, action);
              return next;
            },
            pass: () => {
              next = this.handleDiscard(next, action);
              return next;
            },
          },
          () => next,
        );
      },
    );
    return this.ensurePawnSelectionPrompt(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    const resolved = resolvePendingPawnChoiceAction({
      state,
      action,
      pendingType: 'choose_pawn',
      resolveChoice: (rawPawn, options) =>
        this.setupFlow.resolvePawnChoice(rawPawn, options),
    }) as {
      playerId: number;
      options: any[];
      chosen: { id: string; label: string };
    } | null;
    if (!resolved) return state;
    const { playerId, options, chosen } = resolved;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<
      number,
      string
    >;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: CatPattesMetadata = {
      ...meta,
      setupStep: 'choose_pawn',
      pawns:
        Array.isArray(meta.pawns) && meta.pawns.length > 0
          ? meta.pawns
          : (options.map((p: any) =>
              String(p?.label ?? p?.id ?? '').trim(),
            ) as any),
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: nextMeta,
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} choisit le pion : ${chosen.label}.`,
    );

    const playersForPending = Array.isArray(next.players) ? next.players : [];
    const metaForPending = this.getMeta(next);
    const pawnByPlayerIdForPending = metaForPending.pawnByPlayerId ?? {};
    const usedForPending = new Set(
      Object.values(pawnByPlayerIdForPending).filter(
        (v) => typeof v === 'string',
      ),
    );
    const choicesForPending = (metaForPending.pawns ?? []).filter(
      (p) => !usedForPending.has(p),
    );
    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players: playersForPending,
      startPlayerId: playerId,
      isAssigned: (candidateId) => {
        const player = playersForPending.find((p) => p?.id === candidateId);
        return (
          Boolean(pawnByPlayerIdForPending[candidateId]) ||
          this.isBotLike(player)
        );
      },
      pawns: choicesForPending.map((name) => ({ id: name, label: name })),
    });
    if (pendingInfo) {
      const withPending: GameStateEntity = {
        ...next,
        pending: pendingInfo.pending,
        turnIndex: pendingInfo.turnIndex,
        turn: {
          ...(next.turn ?? { direction: 1 }),
          currentPlayerId: pendingInfo.playerId,
          direction: 1,
        },
      };
      return this.ensurePawnSelectionPrompt(withPending);
    }

    next = this.assignMissingBotPawns(next);

    const players = Array.isArray(next.players) ? next.players : [];
    const starterId =
      typeof nextMeta.setupStarterId === 'number'
        ? nextMeta.setupStarterId
        : (players[0]?.id ?? null);
    const starterIndex =
      starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
    const resolvedStarterId =
      starterId != null && starterIndex >= 0
        ? starterId
        : (players[0]?.id ?? null);

    let started: GameStateEntity = {
      ...next,
      pending: null,
      metadata: {
        ...this.getMeta(next),
        setupStep: 'playing',
      } as any,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: {
        ...(next.turn ?? { direction: 1 }),
        currentPlayerId: resolvedStarterId,
        direction: 1,
      },
    };
    started = this.core.appendLog(
      started,
      `Début de partie : ${resolvePlayerNameFromState(started, resolvedStarterId ?? 0)} commence.`,
    );
    return this.getTurnPolicies().appendTurnAnnouncement(
      started,
      resolvedStarterId,
      (s, id) => resolvePlayerNameFromState(s, id),
    );
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;
    if ((this.getMeta(state).setupStep ?? '') === 'setup_config') return state;

    const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    if (this.samePlayerId(meta.drawnPlayerId, currentId)) return state;

    const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, currentId);
    let next = this.setMeta(state, {
      ...updatedMeta,
      drawnPlayerId: currentId,
    });
    if (cardId) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} pioche ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
      );
      return next;
    }
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} pioche.`,
    );

    const remainingHand = Array.isArray(updatedMeta.hands?.[currentId])
      ? updatedMeta.hands[currentId]
      : [];
    if (remainingHand.length > 0) return next;

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} ne peut plus piocher.`,
    );
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} passe son tour.`,
    );
    next = this.clearDrawn(next);
    return this.turns.advanceTurn(next);
  }

  private handleDiscard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
    if (currentId == null) return state;
    const meta = this.getMeta(state);
    if ((meta.setupStep ?? '') === 'setup_config') return state;
    if (!this.samePlayerId(meta.drawnPlayerId, currentId)) return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    let cardId = String(payload.cardId ?? '').trim();
    const hand = Array.isArray(meta.hands?.[currentId])
      ? [...meta.hands[currentId]]
      : [];
    if (!cardId) cardId = String(hand[0] ?? '').trim();
    if (!cardId || !hand.includes(cardId)) return state;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} défausse ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
    );
    next = this.clearDrawn(next);
    return this.turns.advanceTurn(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
    if (currentId == null) return state;
    if ((this.getMeta(state).setupStep ?? '') === 'setup_config') return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;

    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) return state;

    const meta = this.getMeta(state);
    if (meta.drawnPlayerId !== currentId) return state;
    const hand = Array.isArray(meta.hands?.[currentId])
      ? meta.hands[currentId]
      : [];

    if (!hand.includes(cardId)) return state;

    if (definition.type === 'pattes') {
      if (!canPlayPattes(meta, currentId, definition)) return state;
      const currentPos = Number(meta.positions?.[currentId] ?? 0);
      const delta = Number(definition.value ?? 0);
      if (!Number.isFinite(delta) || currentPos + delta > this.getGoalPattes(meta))
        return state;
    }

    if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number'
          ? payload.targetPlayerId
          : null;

      if (targetId == null || targetId === currentId) return state;
      if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle!))
        return state;
    }

    const hadObstacle = Boolean(meta.obstacles?.[currentId]);
    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);

    if (definition.type === 'pattes') {
      next = this.playPattes(next, currentId, definition);
    } else if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number'
          ? payload.targetPlayerId
          : null;

      if (targetId != null) {
        next = this.playObstacle(next, currentId, targetId, definition);
      }
    } else if (definition.type === 'parade') {
      next = this.playParade(next, currentId, definition);
    } else if (definition.type === 'bot') {
      next = this.playBot(next, currentId, definition);
    }

    if (this.getMeta(next).winnerId != null) {
      return this.clearDrawn(next);
    }

    // Règle: si un Pouvoir est joué en réponse à un obstacle, le joueur rejoue immédiatement.
    // Interprétation: si un obstacle est actif au moment où le Pouvoir est joué, on conserve le tour.
    if (definition.type === 'bot' && hadObstacle) {
      const withLog = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} rejoue immédiatement grâce au Pouvoir.`,
      );
      return this.clearDrawn(withLog);
    }

    next = this.clearDrawn(next);
    return this.turns.advanceTurn(next);
  }

  private handleSetConfig(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const meta = this.getMeta(state);
    if ((meta.setupStep ?? '') !== 'setup_config') return state;

    const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
    if (currentId == null || !this.samePlayerId(meta.ownerPlayerId, currentId)) {
      return state;
    }

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const rawGoal = Number(payload.goalPattes ?? payload.value ?? null);
    if (!Number.isFinite(rawGoal)) return state;
    const goalPattes = Math.round(rawGoal);
    if (goalPattes < 600 || goalPattes > 1500) return state;

    let next = this.setMeta(state, {
      ...meta,
      setupStep: 'choose_pawn',
      goalPattes,
    });
    next = {
      ...next,
      pending: null,
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} fixe l'objectif à ${goalPattes} pattes.`,
    );
  }

  private playPattes(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const goalPattes = this.getGoalPattes(meta);
    const positions = { ...(meta.positions ?? {}) };
    const previous = positions[playerId] ?? 0;
    const delta = card.value ?? 0;
    const nextPosition = previous + delta;
    positions[playerId] = nextPosition;

    const turboPlayed = { ...(meta.turboPlayed ?? {}) };
    if ((card.value ?? 0) === 150) {
      turboPlayed[playerId] = (turboPlayed[playerId] ?? 0) + 1;
    }

    let next = this.setMeta(state, {
      ...meta,
      positions,
      turboPlayed,
    });

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} joue ${card.name} et avance de ${delta} pattes (total ${nextPosition}/${goalPattes}).`,
    );

    if (nextPosition === goalPattes) {
      const finalMeta = this.getMeta(next);
      const roundPoints = this.computeRoundPoints(
        next,
        playerId,
        finalMeta,
        goalPattes,
      );
      const points = { ...(finalMeta.points ?? {}) };
      points[playerId] = (points[playerId] ?? 0) + roundPoints;
      next = this.setMeta(next, {
        ...finalMeta,
        points,
        winnerId: playerId,
      });
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} atteint ${goalPattes} pattes et remporte la manche (${roundPoints} points).`,
      );
      return { ...next, status: 'finished' };
    }

    return next;
  }

  private computeRoundPoints(
    state: GameStateEntity,
    winnerId: number,
    meta: CatPattesMetadata,
    goalPattes: number,
  ): number {
    let points = goalPattes;

    const turboCount = Number(meta.turboPlayed?.[winnerId] ?? 0);
    if (turboCount >= 4) points += 200;

    const players = (state.players ?? []).filter((p: any) => p?.id != null);
    const othersBlocked = players
      .filter((p: any) => p.id !== winnerId)
      .every((p: any) => Boolean(meta.obstacles?.[p.id]));
    if (othersBlocked && players.length > 1) points += 100;

    const botCount = Array.isArray(meta.bots?.[winnerId])
      ? meta.bots[winnerId].length
      : 0;
    if (botCount >= 4) points += 300;

    return points;
  }

  private playObstacle(
    state: GameStateEntity,
    playerId: number,
    targetId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const obstacle = card.obstacle;
    if (!obstacle) return state;

    const meta = this.getMeta(state);
    if (!playerCanReceiveObstacle(meta, targetId, obstacle)) {
      return state;
    }

    const obstacles = { ...(meta.obstacles ?? {}) };
    obstacles[targetId] = obstacle;
    let next = this.setMeta(state, { ...meta, obstacles });
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} inflige ${card.name} à ${resolvePlayerNameFromState(next, targetId)}.`,
    );
    const targetName = resolvePlayerNameFromState(next, targetId);
    const impact = OBSTACLE_IMPACTS[obstacle];
    next = this.core.appendLog(next, `${targetName} ${impact}.`);
    return next;
  }

  private playParade(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const obstacles = { ...(meta.obstacles ?? {}) };
    const currentObstacle = obstacles[playerId] ?? null;
    const parade = card.parade ?? null;
    if (
      currentObstacle &&
      parade &&
      CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === parade
    ) {
      const obstacleLabel = OBSTACLE_LABELS[currentObstacle] ?? currentObstacle;
      obstacles[playerId] = null;
      meta = { ...meta, obstacles };
      next = this.setMeta(next, meta);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} neutralise ${obstacleLabel} avec ${card.name}.`,
      );
      meta = this.getMeta(next);
    } else if (currentObstacle) {
      const obstacleLabel = OBSTACLE_LABELS[currentObstacle] ?? currentObstacle;
      const paradeLabel = parade ? PARADE_LABELS[parade] ?? parade : card.name;
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} joue ${paradeLabel} mais ne retire pas l'obstacle (${obstacleLabel}).`,
      );
    } else {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} joue ${card.name} mais n'a aucun obstacle à retirer.`,
      );
    }

    if (parade === 'rayon') {
      const hasSun = { ...(meta.hasSun ?? {}) };
      const alreadyActive = Boolean(hasSun[playerId]);
      hasSun[playerId] = true;
      meta = { ...meta, hasSun };
      next = this.setMeta(next, meta);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} ${alreadyActive ? 'a déjà le soleil actif.' : 'active le soleil.'}`,
      );
    }

    return next;
  }

  private playBot(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const bot = card.bot;
    if (!bot) return state;
    const meta = this.getMeta(state);
    const bots = { ...(meta.bots ?? {}) };
    const playerBots = [...(bots[playerId] ?? [])];
    if (!playerBots.includes(bot)) {
      playerBots.push(bot);
    }
    bots[playerId] = playerBots;
    let next = this.setMeta(state, { ...meta, bots });
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} active ${card.name} (Pouvoir).`,
      );
    const effect = BOT_EFFECTS[bot];
    if (effect) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} : ${effect}`,
      );
    }
    return next;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private drawForPlayer(
    meta: CatPattesMetadata,
    playerId: number,
  ): { meta: CatPattesMetadata; cardId: string | null } {
    const { cardId, meta: withCard } = this.drawOneCard(meta);
    if (!cardId) {
      return { meta: withCard, cardId: null };
    }
    const hands = { ...(withCard.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return {
      meta: {
        ...withCard,
        hands,
      },
      cardId,
    };
  }

  private drawOneCard(meta: CatPattesMetadata): {
    meta: CatPattesMetadata;
    cardId: string | null;
  } {
    const out = this.deckPolicies.drawOne<string, CatPattesMetadata>({
      meta,
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });
    return {
      cardId: out.card,
      meta: out.meta,
    };
  }

  private removeCardFromHand(
    meta: CatPattesMetadata,
    playerId: number,
    cardId: string,
  ): CatPattesMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId])
      ? [...hands[playerId]]
      : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: CatPattesMetadata,
    cardId: string,
  ): CatPattesMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private getMeta(state: GameStateEntity): CatPattesMetadata {
    return (state.metadata ?? {}) as CatPattesMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: CatPattesMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta = this.getMeta(state);
    if ((meta.setupStep ?? '') === 'setup_config') return state;
    const hasAssignedPawn = (playerId: number): boolean => {
      if (meta.pawnByPlayerId?.[playerId]) return true;
      const player = players.find((p) => Number(p?.id) === Number(playerId));
      const playerPawn =
        typeof player?.pawn === 'string' ? player.pawn.trim() : '';
      return playerPawn.length > 0;
    };
    const needsPawn = (player: any): boolean =>
      !this.isBotLike(player) && !hasAssignedPawn(Number(player?.id));

    const missingHumans = players.filter((player) => needsPawn(player));
    if (!missingHumans.length) {
      const clearedState =
        state.pending?.type === 'choose_pawn' ? { ...state, pending: null } : state;
      if ((meta.setupStep ?? '') !== 'playing') {
        return this.setMeta(clearedState, {
          ...this.getMeta(clearedState),
          setupStep: 'playing',
        });
      }
      return clearedState;
    }

    if (state.pending?.type === 'choose_pawn') {
      const pendingPlayerId = Number(state.pending.playerId);
      if (
        Number.isFinite(pendingPlayerId) &&
        missingHumans.some((player) => Number(player?.id) === pendingPlayerId)
      ) {
        return state;
      }
    }

    const usedPawns = new Set(
      Object.values(meta.pawnByPlayerId ?? {}).filter(
        (pawn): pawn is string =>
          typeof pawn === 'string' && pawn.trim().length > 0,
      ),
    );
    const allPawns = Array.isArray(meta.pawns) ? meta.pawns : [];
    const availablePawns = allPawns.filter((pawn) => !usedPawns.has(pawn));
    const selectedPawns = availablePawns.length > 0 ? availablePawns : allPawns;
    if (!selectedPawns.length) return state;

    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players,
      startPlayerId:
        typeof state.turn?.currentPlayerId === 'number'
          ? state.turn.currentPlayerId
          : (players[0]?.id ?? null),
      isAssigned: (playerId) => {
        const player = players.find((entry) => Number(entry?.id) === playerId);
        return this.isBotLike(player) || hasAssignedPawn(playerId);
      },
      pawns: selectedPawns.map((name) => ({ id: name, label: name })),
    });
    if (!pendingInfo) return state;

    const next: GameStateEntity = {
      ...state,
      pending: pendingInfo.pending,
      turnIndex: pendingInfo.turnIndex,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo.playerId,
        direction: 1,
      },
    };
    return next;
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }

  private assignMissingBotPawns(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<
      number,
      string
    >;
    const used = new Set(
      Object.values(assigned).filter(
        (v) => typeof v === 'string' && v.trim().length > 0,
      ),
    );
    const pool = Array.isArray(meta.pawns)
      ? meta.pawns.filter((pawn) => !used.has(pawn))
      : [];
    const out = this.random.shuffle(meta as any, pool);
    const pawns = Array.isArray(out.values) ? out.values : [];
    const shuffledRng = out.meta?.rng ?? meta.rng;

    let next = state;
    let changed = false;
    let pawnIndex = 0;
    for (const player of players) {
      if (!player?.id || !this.isBotLike(player)) continue;
      if (assigned[player.id]) continue;
      const nextPawn = pawns[pawnIndex];
      if (!nextPawn) break;
      assigned[player.id] = nextPawn;
      used.add(nextPawn);
      pawnIndex += 1;
      changed = true;
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, player.id)} choisit le pion : ${nextPawn}.`,
      );
    }

    if (!changed) return state;
    return this.setMeta(next, {
      ...this.getMeta(next),
      rng: shuffledRng,
      pawnByPlayerId: assigned,
    });
  }

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '')
      .trim()
      .toLowerCase();
    if (username.includes('bot')) return true;
    const kind = String(player?.kind ?? player?.type ?? '')
      .trim()
      .toLowerCase();
    return kind === 'bot' || kind === 'ai';
  }

  private toPlayerId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private samePlayerId(left: unknown, right: unknown): boolean {
    const a = this.toPlayerId(left);
    const b = this.toPlayerId(right);
    return a != null && b != null && a === b;
  }

  private getGoalPattes(meta: CatPattesMetadata): number {
    const parsed = Number(meta.goalPattes ?? CAT_PATTES_GOAL);
    if (!Number.isFinite(parsed)) return CAT_PATTES_GOAL;
    const rounded = Math.round(parsed);
    if (rounded < 600 || rounded > 1500) return CAT_PATTES_GOAL;
    return rounded;
  }
}
