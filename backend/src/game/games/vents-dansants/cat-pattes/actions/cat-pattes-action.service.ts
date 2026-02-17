import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { PromptPoliciesService } from '../../../../modules/prompt-policies/services/prompt-policies.service';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesCardDefinition,
} from '../model/cat-pattes-cards';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
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
};

@Injectable()
export class CatPattesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly setupFlow: SetupFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly random: RandomService,
    private readonly turnPolicies?: TurnPoliciesService,
    private readonly promptPolicies?: PromptPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(this.ensurePawnSelectionPrompt(state), actions, (next, action) => {
          const type = normalizeActionType(action);
          return dispatchByActionType(
            type,
            {
              'choose_pawn': () => {
                next = this.handleChoosePawn(next, action);
            next = this.ensurePawnSelectionPrompt(next);
                return next;
              },
              'draw': () => {
                next = this.handleDraw(next);
                return next;
              },
              'play_card': () => {
                next = this.handlePlayCard(next, action);
                return next;
              },
              'discard_card': () => {
                next = this.handleDiscard(next, action);
                return next;
              },
              'pass': () => {
                next = this.handleDiscard(next, action);
                return next;
              },
            },
            () => next,
          );
        });
        return this.ensurePawnSelectionPrompt(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = (action?.payload ?? {}) as CatPattesActionPayload;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const chosen = this.resolvePendingPawn(rawPawn, options);
    if (!chosen) return state;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: CatPattesMetadata = {
      ...meta,
      pawns:
        Array.isArray(meta.pawns) && meta.pawns.length > 0
          ? meta.pawns
          : options.map((p: any) => String(p?.label ?? p?.id ?? '').trim()),
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: nextMeta,
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion : ${chosen.label}.`,
    );

    const pendingInfo = this.buildPawnPending(next, playerId);
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
        : players[0]?.id ?? null;
    const starterIndex =
      starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
    const resolvedStarterId =
      starterId != null && starterIndex >= 0 ? starterId : players[0]?.id ?? null;

    let started: GameStateEntity = {
      ...next,
      pending: null,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: {
        ...(next.turn ?? { direction: 1 }),
        currentPlayerId: resolvedStarterId,
        direction: 1,
      },
    };
    started = this.core.appendLog(
      started,
      `Début de partie : ${this.playerName(started, resolvedStarterId ?? 0)} commence.`,
    );
    return this.getTurnPolicies().appendTurnAnnouncement(
      started,
      resolvedStarterId,
      (s, id) => this.playerName(s, id),
    );
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    if (meta.drawnPlayerId === currentId) return state;

    const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, currentId);
    let next = this.setMeta(state, { ...updatedMeta, drawnPlayerId: currentId });
    next = this.core.appendLog(next, `${this.playerName(next, currentId)} pioche.`);
    if (cardId) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} pioche ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
      );
    }
    return next;
  }

  private handleDiscard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const meta = this.getMeta(state);
    if (meta.drawnPlayerId !== currentId) return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    let cardId = String(payload.cardId ?? '').trim();
    const hand = Array.isArray(meta.hands?.[currentId]) ? [...meta.hands[currentId]] : [];
    if (!cardId) cardId = String(hand[0] ?? '').trim();
    if (!cardId || !hand.includes(cardId)) return state;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} défausse ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
    );
    next = this.clearDrawn(next);
    return this.turns.advanceTurn(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;

    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) return state;

    let meta = this.getMeta(state);
    if (meta.drawnPlayerId !== currentId) return state;
    const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
    if (!hand.includes(cardId)) return state;

    if (definition.type === 'pattes') {
      if (!canPlayPattes(meta, currentId, definition)) return state;
      const currentPos = Number(meta.positions?.[currentId] ?? 0);
      const delta = Number(definition.value ?? 0);
      if (!Number.isFinite(delta) || currentPos + delta > CAT_PATTES_GOAL) return state;
    }

    if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
      if (targetId == null || targetId === currentId) return state;
      if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle!)) return state;
    }

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);

    if (definition.type === 'pattes') {
      next = this.playPattes(next, currentId, definition);
    } else if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
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

    next = this.clearDrawn(next);
    return this.turns.advanceTurn(next);
  }

  private playPattes(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const meta = this.getMeta(state);
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
        `${this.playerName(next, playerId)} joue ${card.name} et avance de ${delta} pattes (total ${nextPosition}/${CAT_PATTES_GOAL}).`,
      );

    if (nextPosition === CAT_PATTES_GOAL) {
      const finalMeta = this.getMeta(next);
      const roundPoints = this.computeRoundPoints(next, playerId, finalMeta);
      const points = { ...(finalMeta.points ?? {}) };
      points[playerId] = (points[playerId] ?? 0) + roundPoints;
      next = this.setMeta(next, {
        ...finalMeta,
        points,
        winnerId: playerId,
      });
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} atteint ${CAT_PATTES_GOAL} pattes et remporte la manche (${roundPoints} points).`,
      );
      return { ...next, status: 'finished' };
    }

    return next;
  }

  private computeRoundPoints(
    state: GameStateEntity,
    winnerId: number,
    meta: CatPattesMetadata,
  ): number {
    let points = CAT_PATTES_GOAL;

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
      `${this.playerName(next, playerId)} inflige ${card.name} à ${this.playerName(next, targetId)}.`,
    );
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
    if (
      currentObstacle &&
      card.parade &&
      CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === card.parade
    ) {
      obstacles[playerId] = null;
      meta = { ...meta, obstacles };
      next = this.setMeta(next, meta);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} neutralise ${currentObstacle} avec ${card.name}.`,
      );
      meta = this.getMeta(next);
    }

    if (card.parade === 'rayon') {
      const hasSun = { ...(meta.hasSun ?? {}) };
      hasSun[playerId] = true;
      meta = { ...meta, hasSun };
      next = this.setMeta(next, meta);
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
      `${this.playerName(next, playerId)} active ${card.name}.`,
    );
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
    const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
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

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((player) => player?.id === playerId);
    return p?.username?.trim() || `Joueur ${playerId}`;
  }

  private buildPawnPending(
    state: GameStateEntity,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return null;

    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    const choices = (meta.pawns ?? []).filter((p) => !used.has(p));

    return this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: startId,
      isAssigned: (playerId) => {
        const player = players.find((p) => p?.id === playerId);
        return Boolean(pawnByPlayerId[playerId]) || this.isBotLike(player);
      },
      pendingType: 'choose_pawn',
      choices: choices.map((name) => ({ id: name, label: name })),
      labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir son pion.`,
      dataBuilder: (availableChoices) => ({
        pawns: availableChoices.map((choice) => ({
          id: String(choice.id ?? '').trim(),
          label: String(choice.label ?? '').trim(),
        })),
      }),
    });
  }

  private resolvePendingPawn(
    raw: unknown,
    options: Array<{ id?: string; label?: string }>,
  ): { id: string; label: string } | null {
    const normalized = (Array.isArray(options) ? options : [])
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
      }))
      .filter((p) => p.id.length > 0 && p.label.length > 0);
    if (!normalized.length) return null;

    const candidate =
      typeof raw === 'object' && raw != null
        ? (raw as any)?.id ??
          (raw as any)?.pawnId ??
          (raw as any)?.pawn ??
          (raw as any)?.value ??
          (raw as any)?.label ??
          raw
        : raw;
    return this.setupFlow.resolveChoice(candidate, normalized) as
      | { id: string; label: string }
      | null;
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    return this.getPromptPolicies().ensurePendingPlayerPrompt(
      state,
      'choose_pawn',
      (playerId) => `${this.playerName(state, playerId)} doit choisir un pion.`,
    );
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }

  private getPromptPolicies(): PromptPoliciesService {
    return this.promptPolicies ?? new PromptPoliciesService(this.core);
  }

  private assignMissingBotPawns(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    const used = new Set(
      Object.values(assigned).filter((v) => typeof v === 'string' && v.trim().length > 0),
    );
    const pool = Array.isArray(meta.pawns)
      ? meta.pawns.filter((pawn) => !used.has(pawn))
      : [];
    const out = this.random.shuffle(meta as any, pool);
    const pawns = Array.isArray(out.values) ? out.values : [];
    const shuffledRng = (out.meta as any)?.rng ?? meta.rng;

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
        `${this.playerName(next, player.id)} choisit le pion : ${nextPawn}.`,
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
    if (typeof player.isBot === 'boolean') return false;
    const kind = String(player?.kind ?? player?.type ?? '').trim().toLowerCase();
    return kind === 'bot';
  }
}




