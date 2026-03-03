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
} from '../model/cat-pattes-cards';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import {
  CAT_PATTES_DEFAULT_ROUNDS,
  CAT_PATTES_GOAL,
} from '../model/cat-pattes-state.entity';
import {
  CAT_PATTES_OBSTACLE_TO_PARADE,
  canPlayPattes,
  canPlayParade,
  canPlayBot,
  isBlockedByObstacle,
  playerCanReceiveObstacle,
} from '../rulebook/rulebook';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  pawnId?: string | null;
  pawn?: string | null;
  value?: string | null;
  roundsToPlay?: number | null;
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
      `${resolvePlayerNameFromState(next, playerId)} a choisi le pion : ${chosen.label}.`,
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

    const blockedByObstacle = isBlockedByObstacle(meta, currentId);
    if (
      blockedByObstacle &&
      definition.type !== 'parade' &&
      definition.type !== 'bot'
    ) {
      return state;
    }

    if (definition.type === 'pattes') {
      if (!canPlayPattes(meta, currentId, definition)) return state;
      const currentPos = Number(meta.positions?.[currentId] ?? 0);
      const delta = Number(definition.value ?? 0);
      if (
        !Number.isFinite(delta) ||
        currentPos + delta > this.getGoalPattes(meta)
      )
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
    if (definition.type === 'parade') {
      if (!canPlayParade(meta, currentId, definition)) return state;
    }
    if (definition.type === 'bot') {
      if (!canPlayBot(meta, currentId, definition)) return state;
    }

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);
    next = this.appendPlayedCardNarration(next, currentId, definition);

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
    if (!this.samePlayerId(this.getMeta(next).drawnPlayerId, currentId)) {
      return next;
    }

    // Règle: un Pouvoir rejoue immédiatement.
    if (definition.type === 'bot') {
      return this.clearDrawn(next);
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
    if (
      currentId == null ||
      !this.samePlayerId(meta.ownerPlayerId, currentId)
    ) {
      return state;
    }

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const rawRounds = Number(payload.roundsToPlay ?? payload.value ?? null);
    if (!Number.isFinite(rawRounds)) return state;
    const roundsToPlay = Math.round(rawRounds);
    if (roundsToPlay < 1 || roundsToPlay > 20) return state;

    let next = this.setMeta(state, {
      ...meta,
      setupStep: 'choose_pawn',
      goalPattes: CAT_PATTES_GOAL,
      roundsToPlay,
      completedRounds: 0,
    });
    next = {
      ...next,
      pending: null,
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} fixe la partie à ${roundsToPlay} manche(s), objectif ${CAT_PATTES_GOAL} pattes par manche.`,
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

    if (nextPosition === goalPattes) {
      const finalMeta = this.getMeta(next);
      const points = { ...(finalMeta.points ?? {}) };
      for (const [pidRaw, pattesRaw] of Object.entries(finalMeta.positions ?? {})) {
        const pid = Number(pidRaw);
        if (!Number.isFinite(pid)) continue;
        const pattes = Number(pattesRaw ?? 0);
        points[pid] = (points[pid] ?? 0) + (Number.isFinite(pattes) ? pattes : 0);
      }
      const completedRounds = Number(finalMeta.completedRounds ?? 0) + 1;
      const roundsToPlay = this.getRoundsToPlay(finalMeta);
      next = this.setMeta(next, {
        ...finalMeta,
        points,
        completedRounds,
        winnerId: null,
        drawnPlayerId: null,
      });
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} atteint ${goalPattes} pattes et remporte la manche.`,
      );
      if (completedRounds >= roundsToPlay) {
        const winnerId = this.resolveWinnerByTotalPattes(next);
        const winnerName =
          winnerId != null ? resolvePlayerNameFromState(next, winnerId) : null;
        next = this.setMeta(next, {
          ...this.getMeta(next),
          winnerId,
          drawnPlayerId: null,
        });
        next = this.core.appendLog(
          next,
          winnerName
            ? `${winnerName} remporte la partie avec le plus de pattes cumulées.`
            : 'Partie terminée.',
        );
        return { ...next, status: 'finished' };
      }
      return this.startNextRound(next, playerId);
    }

    return next;
  }

  private playObstacle(
    state: GameStateEntity,
    _playerId: number,
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
    return this.setMeta(state, { ...meta, obstacles });
  }

  private playParade(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const parade = card.parade ?? null;
    if (!parade) return state;

    const obstacles = { ...(meta.obstacles ?? {}) };
    const currentObstacle = obstacles[playerId] ?? null;
    const removesObstacle =
      currentObstacle &&
      CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === parade;

    if (removesObstacle) {
      obstacles[playerId] = null;
      meta = { ...meta, obstacles };
      next = this.setMeta(next, meta);
      meta = this.getMeta(next);
    } else if (!currentObstacle && parade === 'rayon') {
      // Rayon autorisé sans obstacle (début de manche / après parade).
    } else {
      return state;
    }

    if (parade === 'rayon') {
      const hasSun = { ...(meta.hasSun ?? {}) };
      hasSun[playerId] = true;
      const sunReady = { ...(meta.sunReady ?? {}) };
      sunReady[playerId] = false;
      const obstacleLock = { ...(meta.obstacleLock ?? {}) };
      obstacleLock[playerId] = false;
      meta = { ...meta, hasSun, sunReady, obstacleLock };
      return this.setMeta(next, meta);
    }

    if (removesObstacle) {
      const sunReady = { ...(meta.sunReady ?? {}) };
      sunReady[playerId] = true;
      const obstacleLock = { ...(meta.obstacleLock ?? {}) };
      obstacleLock[playerId] = true;
      next = this.setMeta(next, { ...meta, sunReady, obstacleLock });
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

    const currentObstacle = meta.obstacles?.[playerId] ?? null;
    if (
      currentObstacle &&
      ((bot === 'reserve' && currentObstacle === 'gamelle') ||
        (bot === 'chat-ninja' && currentObstacle === 'chien') ||
        (bot === 'patte-blindee' && currentObstacle === 'coussin') ||
        (bot === 'passage-star' &&
          (currentObstacle === 'pluie' || currentObstacle === 'sol')))
    ) {
      const obstacles = { ...(meta.obstacles ?? {}) };
      obstacles[playerId] = null;
      const sunReady = { ...(meta.sunReady ?? {}) };
      sunReady[playerId] = true;
      const obstacleLock = { ...(meta.obstacleLock ?? {}) };
      obstacleLock[playerId] = bot === 'passage-star' ? false : true;
      next = this.setMeta(next, {
        ...meta,
        bots,
        obstacles,
        sunReady,
        obstacleLock,
      });
    }

    return next;
  }

  private appendPlayedCardNarration(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    return this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, playerId)} joue ${card.name}.`,
    );
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
        state.pending?.type === 'choose_pawn'
          ? { ...state, pending: null }
          : state;
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
        `${resolvePlayerNameFromState(next, player.id)} a choisi le pion : ${nextPawn}.`,
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
    if (rounded <= 0) return CAT_PATTES_GOAL;
    return rounded;
  }

  private getRoundsToPlay(meta: CatPattesMetadata): number {
    const parsed = Number(meta.roundsToPlay ?? CAT_PATTES_DEFAULT_ROUNDS);
    if (!Number.isFinite(parsed)) return CAT_PATTES_DEFAULT_ROUNDS;
    const rounded = Math.round(parsed);
    if (rounded < 1 || rounded > 20) return CAT_PATTES_DEFAULT_ROUNDS;
    return rounded;
  }

  private resolveWinnerByTotalPattes(state: GameStateEntity): number | null {
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    if (players.length === 0) return null;
    let winnerId: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const player of players) {
      if (typeof player?.id !== 'number') continue;
      const score = Number(meta.points?.[player.id] ?? 0);
      const safeScore = Number.isFinite(score) ? score : 0;
      if (winnerId == null || safeScore > bestScore) {
        winnerId = player.id;
        bestScore = safeScore;
      }
    }
    return winnerId;
  }

  private startNextRound(
    state: GameStateEntity,
    roundWinnerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players)
      ? state.players.filter((p: any) => p?.id != null)
      : [];
    const playerIds = players.map((p: any) => Number(p.id));
    const deck = Object.keys(CAT_PATTES_CARD_BY_ID);
    const shuffled = this.random.shuffle(meta as any, deck);
    const remainingDeck = Array.isArray(shuffled.values)
      ? [...shuffled.values]
      : [];
    const hands: Record<number, string[]> = {};
    const positions: Record<number, number> = {};
    const obstacles: Record<number, CatPattesObstacleType | null> = {};
    const bots: Record<number, CatPattesBotType[]> = {};
    const hasSun: Record<number, boolean> = {};
    const sunReady: Record<number, boolean> = {};
    const obstacleLock: Record<number, boolean> = {};
    const turboPlayed: Record<number, number> = {};

    for (const playerId of playerIds) {
      positions[playerId] = 0;
      obstacles[playerId] = null;
      bots[playerId] = [];
      hasSun[playerId] = false;
      sunReady[playerId] = true;
      obstacleLock[playerId] = false;
      turboPlayed[playerId] = 0;
      const hand: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        if (!remainingDeck.length) break;
        hand.push(remainingDeck.shift()!);
      }
      hands[playerId] = hand;
    }

    const starterId = playerIds.includes(roundWinnerId)
      ? roundWinnerId
      : (playerIds[0] ?? roundWinnerId);
    const starterIndex = players.findIndex(
      (p: any) => Number(p?.id) === starterId,
    );
    let next = this.setMeta(state, {
      ...meta,
      rng: shuffled.meta?.rng ?? meta.rng,
      deck: remainingDeck,
      discard: [],
      hands,
      positions,
      obstacles,
      bots,
      hasSun,
      sunReady,
      obstacleLock,
      turboPlayed,
      setupStep: 'playing',
      setupStarterId: starterId,
      drawnPlayerId: null,
      winnerId: null,
    });

    next = {
      ...next,
      pending: null,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: {
        ...(next.turn ?? { direction: 1 }),
        currentPlayerId: starterId,
        direction: 1,
      },
    };
    next = this.core.appendLog(
      next,
      `Nouvelle manche : ${resolvePlayerNameFromState(next, starterId)} commence.`,
    );
    return this.getTurnPolicies().appendTurnAnnouncement(
      next,
      starterId,
      (s, id) => resolvePlayerNameFromState(s, id),
    );
  }
}
