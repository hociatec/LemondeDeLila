import { Injectable } from '@nestjs/common';
import type { GameStateEntity, PendingState } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  PiratesEnVadrouilleBonusCard,
  PiratesEnVadrouilleCollection,
  PiratesEnVadrouilleMetadata,
  PiratesEnVadrouilleObstacleCard,
  PiratesEnVadrouilleTreasureCard,
} from '../model/pirates-en-vadrouille-state.entity';
import { OBSTACLE_CARD_EFFECTS, BONUS_CARD_EFFECTS, PiratesCardEffect } from './pirate-card-effects';

type DeckName = 'bonus' | 'treasure' | 'obstacle';

@Injectable()
export class PiratesEnVadrouilleActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const meta = this.getMeta(state);
    const skip = meta.statuses.skipTurn?.[playerId] ?? 0;
    if (skip > 0) {
      const nextStatuses = {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: Math.max(0, skip - 1),
        },
      };
      return this.turns.advanceTurn(
        this.core.appendLog(
          {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, statuses: nextStatuses },
          },
          `${this.playerName(state, playerId)} saute son tour (${skip} restant).`,
        ),
      );
    }

    const rng = this.random.rollDice(meta as any, 6);
    const nextMeta = { ...meta, ...rng.meta };
    let next: GameStateEntity = {
      ...state,
      lastRoll: rng.roll,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} lance le dé : "${rng.roll}".`,
    );

    next = this.move(next, playerId, rng.roll);
    next = this.applyLanding(next, playerId);

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) {
      return { ...next, status: 'finished' };
    }
    if (next.pending) return next;

    if (updatedMeta.keepTurn) {
      const metaCopy = { ...updatedMeta };
      delete metaCopy.keepTurn;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...metaCopy },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue.`,
      );
      return next;
    }

    return this.turns.advanceTurn(next);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_target') return state;
    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = action.payload as any;
    const targetId = Number(payload?.targetPlayerId);
    const options: Array<{ targetPlayerId: number }> = Array.isArray(
      pending?.data?.options,
    )
      ? pending.data.options
      : [];
    if (
      !Number.isFinite(targetId) ||
      !options.some((opt) => opt.targetPlayerId === targetId)
    ) {
      return state;
    }

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (!ctx || ctx.actorId !== playerId) {
      return { ...state, pending: null };
    }

    let next = this.applyTargetEffect(state, targetId, ctx);
    const updatedMeta = this.getMeta(next);
    next = {
      ...next,
      pending: null,
      metadata: {
        ...(next.metadata ?? {}),
        ...updatedMeta,
        pendingContext: null,
      },
    };

    if (next.pending) return next;
    return this.turns.advanceTurn(next);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} met ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );

    switch (tile.type) {
      case 'bonus':
        return this.drawCard(next, playerId, 'bonus');
      case 'treasure':
        return this.drawCard(next, playerId, 'treasure');
      case 'obstacle':
        return this.drawCard(next, playerId, 'obstacle');
      case 'gold':
        return this.collectGold(next, playerId);
      case 'finish':
        return this.handleFinish(next, playerId);
      default:
        return next;
    }
  }

  private drawCard(
    state: GameStateEntity,
    playerId: number,
    deckName: DeckName,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const draw = this.drawFromDeck(meta, deckName);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...draw.meta },
    };
    const card =
      draw.card as
        | PiratesEnVadrouilleBonusCard
        | PiratesEnVadrouilleTreasureCard
        | PiratesEnVadrouilleObstacleCard
        | null;
    if (!card) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} n’a plus de cartes ${deckName}.`,
      );
    }

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pioche la carte "${card.title}".`,
    );
    next = this.addCardToCollection(next, playerId, deckName, card);

    if (deckName === 'treasure') {
      return next;
    }
    if (deckName === 'bonus') {
      return this.applyBonusCard(
        next,
        playerId,
        card as PiratesEnVadrouilleBonusCard,
      );
    }
    return this.applyObstacleCard(
      next,
      playerId,
      card as PiratesEnVadrouilleObstacleCard,
    );
  }

  private applyBonusCard(
    state: GameStateEntity,
    playerId: number,
    card: PiratesEnVadrouilleBonusCard,
  ): GameStateEntity {
    let next = state;
    const effect = BONUS_CARD_EFFECTS[card.id];
    if (!effect) return next;

    next = this.core.appendLog(
      next,
      this.formatActionMessage(next, effect, playerId),
    );

    switch (effect.kind) {
      case 'move':
        return this.move(next, playerId, effect.delta);
      case 'immunity':
        return this.addImmunity(next, playerId, effect.turns);
      case 'reroll':
        return this.setKeepTurn(next, playerId);
      case 'targetMove':
      case 'stealTreasure':
        return this.promptTargetSelection(next, playerId, effect);
      case 'gainGold':
        return this.modifyGold(next, playerId, effect.amount);
      default:
        return next;
    }
  }

  private applyObstacleCard(
    state: GameStateEntity,
    playerId: number,
    card: PiratesEnVadrouilleObstacleCard,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const immunity = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
    if (immunity > 0) {
      const nextStatuses = {
        ...meta.statuses,
        obstacleImmunity: {
          ...(meta.statuses.obstacleImmunity ?? {}),
          [playerId]: Math.max(0, immunity - 1),
        },
      };
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...meta, statuses: nextStatuses },
      };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} est protégé et ignore l'obstacle "${card.title}".`,
      );
    }

    const effect = OBSTACLE_CARD_EFFECTS[card.id];
    if (!effect) return next;
    next = this.core.appendLog(
      next,
      this.formatActionMessage(next, effect, playerId),
    );

    switch (effect.kind) {
      case 'move':
        return this.move(next, playerId, effect.delta);
      case 'skip':
        return this.addSkip(next, playerId, effect.turns);
      case 'loseGold':
        return this.modifyGold(next, playerId, -effect.amount);
      default:
        return next;
    }
  }

  private applyTargetEffect(
    state: GameStateEntity,
    targetPlayerId: number,
    ctx: PiratesEnVadrouilleMetadata['pendingContext'],
  ): GameStateEntity {
    if (!ctx) return state;
    let next = state;
    if (ctx.kind === 'target_move' && ctx.actorId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, ctx.actorId)} applique ${
          ctx.delta >= 0 ? 'un boost' : 'un ralentissement'
        } à ${this.playerName(next, targetPlayerId)} (${ctx.delta}).`,
      );
      next = this.move(next, targetPlayerId, ctx.delta);
      return next;
    }
    if (ctx.kind === 'steal_treasure' && ctx.actorId != null) {
      const targetCollection = this.getCollection(next, targetPlayerId);
      const stolen = targetCollection.treasures.slice(-1)[0];
      if (!stolen) {
        return this.core.appendLog(
          next,
          `${this.playerName(next, ctx.actorId)} tente de voler un trésor mais ${this.playerName(
            next,
            targetPlayerId,
          )} n'en possède pas.`,
        );
      }
      const trimmed = targetCollection.treasures.slice(0, -1);
      next = this.setCollection(next, targetPlayerId, {
        ...targetCollection,
        treasures: trimmed,
      });
      next = this.addCardToCollection(
        next,
        ctx.actorId,
        'treasure',
        stolen,
      );
      return this.core.appendLog(
        next,
        `${this.playerName(next, ctx.actorId)} dérobe "${stolen.title}" à ${this.playerName(
          next,
          targetPlayerId,
        )}.`,
      );
    }
    return next;
  }

  private promptTargetSelection(
    state: GameStateEntity,
    playerId: number,
    effect: PiratesCardEffect,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const targets = players
      .filter((p) => p?.id != null && p.id !== playerId)
      .map((p) => ({ targetPlayerId: p.id as number }));
    if (!targets.length) return state;

    const pending: PendingState = {
      type: 'choose_target',
      playerId,
      blocking: true,
      label: 'Choisissez un joueur cible.',
      data: { options: targets },
    };
    const meta = this.getMeta(state);
    const pendingContext =
      effect.kind === 'targetMove'
        ? { kind: 'target_move', actorId: playerId, delta: effect.delta }
        : effect.kind === 'stealTreasure'
          ? { kind: 'steal_treasure', actorId: playerId, count: effect.count }
          : null;
    return {
      ...state,
      pending,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        pendingContext,
      },
    };
  }

  private collectGold(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.modifyGold(state, playerId, 1);
  }

  private handleFinish(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collection = this.getCollection(state, playerId);
    if (collection.treasures.length >= 3 || collection.goldPieces >= 3) {
      const next = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...meta, winnerId: playerId },
        status: 'finished',
      };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} ouvre le coffre légendaire et gagne la partie !`,
      );
    }
    const next = this.core.appendLog(
      state,
      `${this.playerName(state, playerId)} n'a pas assez de trésors ou pièces d'or et recule de deux cases.`,
    );
    return this.move(next, playerId, -2);
  }

  private addCardToCollection(
    state: GameStateEntity,
    playerId: number,
    deck: DeckName,
    card:
      | PiratesEnVadrouilleBonusCard
      | PiratesEnVadrouilleObstacleCard
      | PiratesEnVadrouilleTreasureCard,
    force = false,
  ): GameStateEntity {
    const collection = this.getCollection(state, playerId);
    const total = this.getTotalCards(collection);
    if (!force && total >= 5) {
      return this.core.appendLog(
        state,
        `${this.playerName(state, playerId)} a déjà cinq cartes et ne peut pas en ajouter.`,
      );
    }
    const updated = { ...collection };
    if (deck === 'bonus') {
      updated.bonus = [...updated.bonus, card as PiratesEnVadrouilleBonusCard];
    } else if (deck === 'obstacle') {
      updated.obstacles = [
        ...updated.obstacles,
        card as PiratesEnVadrouilleObstacleCard,
      ];
    } else if (deck === 'treasure') {
      updated.treasures = [
        ...updated.treasures,
        card as PiratesEnVadrouilleTreasureCard,
      ];
    }
    return this.setCollection(state, playerId, updated);
  }

  private setCollection(
    state: GameStateEntity,
    playerId: number,
    collection: PiratesEnVadrouilleCollection,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collections = { ...(meta.collections ?? {}), [playerId]: collection };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, collections },
    };
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses.skipTurn?.[playerId] ?? 0;
    const statuses = {
      ...meta.statuses,
      skipTurn: {
        ...(meta.statuses.skipTurn ?? {}),
        [playerId]: current + turns,
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private addImmunity(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
    const statuses = {
      ...meta.statuses,
      obstacleImmunity: {
        ...(meta.statuses.obstacleImmunity ?? {}),
        [playerId]: current + turns,
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private modifyGold(
    state: GameStateEntity,
    playerId: number,
    amount: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collection = this.getCollection(state, playerId);
    const updated = {
      ...collection,
      goldPieces: Math.max(0, collection.goldPieces + amount),
    };
    return this.setCollection(state, playerId, updated);
  }

  private setKeepTurn(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const copy: PiratesEnVadrouilleMetadata = { ...meta, keepTurn: true };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...copy } };
  }

  private drawFromDeck(meta: PiratesEnVadrouilleMetadata, deck: DeckName) {
    const deckList = Array.isArray(meta.decks?.[deck]) ? meta.decks[deck] : [];
    const discardList = Array.isArray(meta.discards?.[deck])
      ? meta.discards[deck]
      : [];
    if (!deckList.length && discardList.length) {
      const shuffled = this.random.shuffle(meta as any, discardList);
      const refreshed: PiratesEnVadrouilleMetadata = {
        ...meta,
        decks: { ...meta.decks, [deck]: shuffled.values as any },
        discards: { ...meta.discards, [deck]: [] },
      };
      return this.drawFromDeck(refreshed, deck);
    }
    if (!deckList.length) return { card: null, meta };
    const [card, ...rest] = deckList;
    const nextMeta: PiratesEnVadrouilleMetadata = {
      ...meta,
      decks: { ...meta.decks, [deck]: rest },
      discards: { ...meta.discards, [deck]: [...discardList, card as any] },
    };
    return { card, meta: nextMeta };
  }

  private formatActionMessage(
    state: GameStateEntity,
    effect: PiratesCardEffect,
    playerId: number,
  ): string {
    const description = (() => {
      switch (effect.kind) {
        case 'move':
          return effect.delta >= 0
            ? `avance de ${effect.delta} cases`
            : `recule de ${Math.abs(effect.delta)} cases`;
        case 'skip':
          return `saute ${effect.turns} tour(s)`;
        case 'immunity':
          return `est protégé contre ${effect.turns} obstacle(s)`;
        case 'gainGold':
          return `gagne ${effect.amount} pièce(s) d'or`;
        case 'loseGold':
          return `perd ${effect.amount} pièce(s) d'or`;
        case 'reroll':
          return 'relance immédiatement le dé';
        case 'targetMove':
          return `rétrograde un adversaire de ${Math.abs(effect.delta)} case(s)`;
        case 'stealTreasure':
          return `tente de voler ${effect.count} trésor(s)`;
        default:
          return 'applique un effet';
      }
    })();
    return `${this.playerName(state, playerId)} ${description}.`;
  }

  private getCollection(
    state: GameStateEntity,
    playerId: number,
  ): PiratesEnVadrouilleCollection {
    const meta = this.getMeta(state);
    const current = meta.collections?.[playerId];
    if (current) return current;
    return {
      treasures: [],
      obstacles: [],
      bonus: [],
      goldPieces: 0,
    };
  }

  private getTotalCards(collection: PiratesEnVadrouilleMetadata['collections'][number]): number {
    return (
      (collection.treasures?.length ?? 0) +
      (collection.obstacles?.length ?? 0) +
      (collection.bonus?.length ?? 0)
    );
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const nextPos = Math.max(
      0,
      Math.min(current + delta, (meta.tiles?.length ?? 1) - 1),
    );
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: PiratesEnVadrouilleMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: pos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === id);
    const name =
      player?.username && String(player.username).trim()
        ? String(player.username).trim()
        : null;
    return name ?? `Joueur ${id}`;
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p: any) => p?.id === id) as any;
    const pawn =
      typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
    const resolved = pawn || this.playerName(state, id);
    return `"${resolved}"`;
  }

  private getMeta(state: GameStateEntity): PiratesEnVadrouilleMetadata {
    return (state.metadata ?? {}) as PiratesEnVadrouilleMetadata;
  }
}
