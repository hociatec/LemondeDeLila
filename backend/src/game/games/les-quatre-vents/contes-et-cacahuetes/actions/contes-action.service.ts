import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  ContesCard,
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.entity';

@Injectable()
export class ContesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'reroll_yes' || type === 'reroll_no') {
        next = this.handleRerollDecision(next, type === 'reroll_yes');
        continue;
      }
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
        continue;
      }
      if (type === 'choose_number') {
        next = this.handleChooseNumber(next, action);
        continue;
      }
      if (type === 'choose_option') {
        next = this.handleChooseOption(next, action);
        continue;
      }
      if (type === 'draw') {
        next = this.handleDraw(next);
        continue;
      }
      if (type === 'choose_card') {
        next = this.handleChooseCard(next, action);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let next = this.autoSkipIfBlocked(state, currentId);
    if ((next.turn?.currentPlayerId ?? null) !== currentId) return next;

    const meta = this.getMeta(next);
    const forced = Number(meta.statuses.forcedRollOneTurns?.[currentId] ?? 0);
    const rollOut =
      forced > 0
        ? { roll: 1, meta: meta as any }
        : this.random.rollDice(meta as any, 6);
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...rollOut.meta },
      lastRoll: rollOut.roll,
    };

    if (forced > 0) {
      next = this.setStatusCount(
        next,
        'forcedRollOneTurns',
        currentId,
        forced - 1,
      );
    }

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : \"${rollOut.roll}\".`,
    );

    const rerollToken = Number(
      this.getMeta(next).statuses.rerollToken?.[currentId] ?? 0,
    );
    if (rerollToken > 0 && this.canUseBonusCards(next, currentId)) {
      next = this.setStatusCount(
        next,
        'rerollToken',
        currentId,
        rerollToken - 1,
      );
      return this.setPending(next, {
        type: 'reroll',
        label: 'Parchemin enchanté : relancer le dé ? (Relancer/Garder)',
        playerId: currentId,
        blocking: true,
        choices: ['Relancer', 'Garder'],
        data: { baseRoll: rollOut.roll },
      });
    }

    next = this.applyMoveFromRoll(next, currentId, rollOut.roll, 0);
    if (String(next.status ?? '').toLowerCase() === 'finished') return next;
    if (next.pending) return next;
    return this.endTurn(next, currentId);
  }

  private handleRerollDecision(
    state: GameStateEntity,
    reroll: boolean,
  ): GameStateEntity {
    const pending = state.pending as any as ContesPending;
    if (!pending || pending.type !== 'reroll') return state;
    const playerId = pending.playerId;
    let next: GameStateEntity = { ...state, pending: null };

    if (reroll) {
      const out = this.random.rollDice(this.getMeta(next) as any, 6);
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...out.meta },
        lastRoll: out.roll,
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} relance le dé : \"${out.roll}\".`,
      );
      next = this.applyMoveFromRoll(next, playerId, out.roll, 0);
    } else {
      const roll = Number(pending.data.baseRoll);
      next = { ...next, lastRoll: roll };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} garde le résultat \"${roll}\".`,
      );
      next = this.applyMoveFromRoll(next, playerId, roll, 0);
    }

    if (String(next.status ?? '').toLowerCase() === 'finished') return next;
    if (next.pending) return next;
    return this.endTurn(next, playerId);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any as ContesPending;
    if (!pending || pending.type !== 'choose_target') return state;
    const playerId = pending.playerId;
    const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
    const target = pending.data.targets.find(
      (t) => t.targetPlayerId === targetPlayerId,
    );
    if (!target) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const ctx = String(pending.data.context ?? '');

    if (ctx === 'move_other_2') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} fait avancer ${this.playerName(next, targetPlayerId)} de 2 cases.`,
      );
      return this.moveBy(next, targetPlayerId, 2, 0);
    }

    if (ctx === 'swap_positions') {
      return this.swapPositions(next, playerId, targetPlayerId);
    }

    if (ctx === 'turn_swap_next') {
      return this.setTurnSwap(next, playerId, targetPlayerId);
    }

    if (ctx === 'song_take_bonus' || ctx === 'steal_bonus') {
      return this.takeOneBonusToken(next, targetPlayerId, playerId);
    }

    if (ctx === 'steal_bonus_or_surprise') {
      return this.startStealTokenChoice(next, playerId, targetPlayerId);
    }

    if (ctx === 'wish_swap') {
      return this.swapPositions(next, playerId, targetPlayerId);
    }

    if (ctx === 'grimoire_voyageur') {
      next = this.swapPositions(next, playerId, targetPlayerId);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, targetPlayerId)} avance d’1 case.`,
      );
      return this.moveBy(next, targetPlayerId, 1, 0);
    }

    if (ctx === 'key_gold_choose_target') {
      return this.setPending(next, {
        type: 'choose_option',
        label: `Clé d’or : choisissez l’effet à appliquer à ${this.playerName(next, targetPlayerId)} (Bonus/Malus).`,
        playerId,
        blocking: true,
        choices: ['Bonus', 'Malus'],
        data: { context: `key_gold_choose_type:${targetPlayerId}` },
      });
    }

    if (ctx === 'give_bonus_choose_target') {
      return this.startGiveBonusChoice(next, playerId, targetPlayerId);
    }

    return next;
  }

  private handleChooseNumber(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any as ContesPending;
    if (!pending || pending.type !== 'choose_number') return state;
    const playerId = pending.playerId;
    const value = Number((action.payload as any)?.value);
    if (!Number.isFinite(value)) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const ctx = String(pending.data.context ?? '');
    if (ctx !== 'laughter_dust') return next;

    const picks: Record<number, number> = {};
    const players = Array.isArray(next.players) ? next.players : [];
    for (const p of players) {
      if (p.id === playerId) {
        picks[p.id] = value;
        continue;
      }
      const out = this.random.nextInt(this.getMeta(next) as any, 3);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      picks[p.id] = out.value + 1;
    }

    const max = Math.max(...Object.values(picks));
    const winners = Object.entries(picks)
      .filter(([, v]) => v === max)
      .map(([k]) => Number(k))
      .filter((x) => Number.isFinite(x));

    next = this.core.appendLog(
      next,
      `Poussière de rire : plus grand choix = ${max}. ${winners.map((id) => this.playerName(next, id)).join(', ')} avance(nt) d’1 case.`,
    );
    for (const id of winners) {
      next = this.moveBy(next, id, 1, 0);
    }
    return next;
  }

  private handleChooseOption(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any as ContesPending;
    if (!pending || pending.type !== 'choose_option') return state;
    const playerId = pending.playerId;
    const option = String((action.payload as any)?.option ?? '');
    if (!pending.choices.some((c) => String(c) === option)) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const ctx = String(pending.data.context ?? '');

    if (ctx === 'song_choice') {
      if (option === 'Avancer de 3') return this.moveBy(next, playerId, 3, 0);
      if (option === 'Prendre une carte Bonus') {
        return this.startChooseTarget(
          next,
          playerId,
          'song_take_bonus',
          'Choisissez un joueur pour lui prendre une carte Bonus.',
        );
      }
    }

    if (ctx === 'wish_ephemere') {
      if (option === 'Avancer de 2') return this.moveBy(next, playerId, 2, 0);
      if (option === 'Échanger')
        return this.startChooseTarget(
          next,
          playerId,
          'wish_swap',
          'Choisissez un joueur pour échanger vos positions.',
        );
      if (option === 'Tirer une carte Bonus')
        return this.drawAndApply(next, playerId, 'bonus', 0);
    }

    if (ctx.startsWith('key_gold_choose_type:')) {
      const targetPlayerId = Number(ctx.split(':')[1]);
      if (!Number.isFinite(targetPlayerId)) return next;
      next = this.setStatusBool(next, 'keyOfGold', playerId, false);
      if (option === 'Bonus')
        return this.drawAndApply(next, targetPlayerId, 'bonus', 0);
      if (option === 'Malus')
        return this.drawAndApply(next, targetPlayerId, 'malus', 0);
    }

    return next;
  }

  private handleChooseCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any as ContesPending;
    if (!pending || pending.type !== 'choose_card') return state;
    const playerId = pending.playerId;

    const cardType = String((action.payload as any)?.cardType ?? '');
    const cardId = Number((action.payload as any)?.cardId);
    const pick = pending.data.cards.find(
      (c) => c.cardType === (cardType as any) && c.cardId === cardId,
    );
    if (!pick) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const ctx = String(pending.data.context ?? '');

    if (ctx.startsWith('abondance_keep_one:')) {
      next = this.core.appendLog(
        next,
        `Corne d’abondance : ${this.playerName(next, playerId)} garde \"${pick.title}\".`,
      );
      return this.applyBonusEffectById(next, playerId, cardId, 0);
    }

    if (ctx.startsWith('give_bonus_to:')) {
      const targetId = Number(ctx.split(':')[1]);
      if (!Number.isFinite(targetId)) return next;
      return this.transferBonusToken(next, playerId, targetId, cardId);
    }

    if (ctx.startsWith('steal_token_from:')) {
      const parts = ctx.split(':');
      const fromId = Number(parts[1]);
      const toId = Number(parts[2]);
      if (!Number.isFinite(fromId) || !Number.isFinite(toId)) return next;
      if (toId !== playerId) return next;

      if (cardType === 'bonus')
        return this.transferBonusToken(next, fromId, toId, cardId);
      if (cardType === 'surprise')
        return this.transferSurpriseToken(next, fromId, toId, cardId);
      return next;
    }

    return next;
  }

  private applyMoveFromRoll(
    state: GameStateEntity,
    playerId: number,
    roll: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const reverse = Boolean(meta.statuses.reverseNextTurn?.[playerId]);
    if (reverse)
      next = this.setStatusBool(next, 'reverseNextTurn', playerId, false);

    let effectiveRoll = roll;
    const replace = Boolean(meta.statuses.replaceOneOn1By4?.[playerId]);
    if (roll === 1 && replace && this.canUseBonusCards(next, playerId)) {
      effectiveRoll = 4;
      next = this.setStatusBool(next, 'replaceOneOn1By4', playerId, false);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} utilise Feuille magique : 1 devient 4.`,
      );
    }

    const delta = reverse ? -effectiveRoll : effectiveRoll;
    return this.moveBy(next, playerId, delta, depth);
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    if (!delta) return state;
    if (depth > 10)
      return this.core.appendLog(state, 'Effet en chaҮne interrompu.');

    const meta = this.getMeta(state);
    const tilesLen = Array.isArray(meta.tiles) ? meta.tiles.length : 60;
    const finishIndex = Math.max(0, tilesLen - 1);
    const current = meta.positions?.[playerId] ?? 0;
    const raw = current + delta;
    const nextPos = raw >= finishIndex ? finishIndex : raw < 0 ? 0 : raw;

    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
      },
    };

    next = this.onAnyPlayerPassedBlocked(next, playerId, nextPos);

    const tile = (this.getMeta(next).tiles ?? [])[nextPos] as
      | ContesCacahuetesTile
      | undefined;
    const labelRaw = String(tile?.label ?? '').trim();
    const label = labelRaw
      ? /^(case|départ|arrivée)\b/i.test(labelRaw)
        ? labelRaw
        : `Case ${nextPos + 1} - ${labelRaw}`
      : `Case ${nextPos + 1}`;
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} arrive sur ${label}.`,
    );
    if (tile?.type === 'bonus')
      next = this.core.appendLog(next, `Effet : piochez une carte Bonus.`);
    else if (tile?.type === 'malus')
      next = this.core.appendLog(next, `Effet : piochez une carte Malus.`);
    else if (tile?.type === 'surprise')
      next = this.core.appendLog(next, `Effet : piochez une carte Surprise.`);
    else if (tile?.type === 'conte')
      next = this.core.appendLog(next, `Effet : piochez une carte Conte.`);
    else if (tile?.type === 'finish')
      next = this.core.appendLog(next, `Effet : case d'arrivée.`);

    if (raw >= finishIndex) {
      next = this.setWinner(next, playerId);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    if (!tile) return next;
    return this.applyTileEffect(next, playerId, tile, depth + 1);
  }

  private applyTileEffect(
    state: GameStateEntity,
    playerId: number,
    tile: ContesCacahuetesTile,
    depth: number,
  ): GameStateEntity {
    if (tile.type === 'bonus')
      return this.drawAndApply(state, playerId, 'bonus', depth);
    if (tile.type === 'malus')
      return this.drawAndApply(state, playerId, 'malus', depth);
    if (tile.type === 'surprise')
      return this.drawAndApply(state, playerId, 'surprise', depth);
    if (tile.type === 'conte')
      return this.applyConteTile(state, playerId, depth);
    return state;
  }

  private applyConteTile(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);

    const key = Boolean(meta.statuses.keyOfGold?.[playerId]);
    if (key && this.canUseBonusCards(state, playerId)) {
      return this.startChooseTarget(
        state,
        playerId,
        'key_gold_choose_target',
        'Clé d’or : choisissez un joueur.',
      );
    }

    const ignore = Boolean(meta.statuses.ignoreNextConteAndAdvance?.[playerId]);
    if (ignore && this.canUseBonusCards(state, playerId)) {
      let next = this.setStatusBool(
        state,
        'ignoreNextConteAndAdvance',
        playerId,
        false,
      );
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} ignore l’effet Conte (Cape d’invisibilité) et avance d’1 case.`,
      );
      return this.moveBy(next, playerId, 1, depth);
    }

    return this.drawAndApply(state, playerId, 'conte', depth);
  }

  private drawAndApply(
    state: GameStateEntity,
    playerId: number,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
    depth: number,
  ): GameStateEntity {
    if (type === 'malus') {
      const protectedOut = this.maybeProtectFromMalus(state, playerId);
      if (protectedOut.protected) {
        return this.core.appendLog(
          protectedOut.state,
          `${this.playerName(state, playerId)} est protҩgҩ du Malus.`,
        );
      }
    }

    return this.setPending(state, {
      type: 'draw',
      label: `Piocher une carte ${type.toUpperCase()} (Espace).`,
      playerId,
      blocking: true,
      data: {
        context: 'draw_and_apply',
        cardType: type,
        depth,
      },
    });
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any as ContesPending | null;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const data = (pending.data ?? {}) as any;
    const context = String(data.context ?? 'draw_and_apply');

    if (context === 'abondance') {
      return this.resolveAbondanceDraw({ ...state, pending: null }, playerId, data);
    }

    return this.resolveQueuedDraw({ ...state, pending: null }, playerId, data);
  }

  private resolveQueuedDraw(
    state: GameStateEntity,
    playerId: number,
    data: { queue?: string[]; cardType?: string; depth?: number },
  ): GameStateEntity {
    const queue = Array.isArray(data.queue) ? [...data.queue] : [];
    const fallbackType = String(data.cardType ?? '').trim().toLowerCase();
    const currentType = (queue.shift() ?? fallbackType) as
      | 'bonus'
      | 'malus'
      | 'surprise'
      | 'conte';
    const depth = Number.isFinite(data.depth) ? Number(data.depth) : 0;

    if (!currentType) return state;

    if (currentType === 'malus') {
      const protectedOut = this.maybeProtectFromMalus(state, playerId);
      if (protectedOut.protected) {
        return this.continueQueuedDraw(
          protectedOut.state,
          playerId,
          queue,
          depth,
        );
      }
    }

    const draw = this.drawCard(state, currentType);
    let next = draw.state;
    const card = draw.card;
    if (!card) {
      next = this.core.appendLog(next, `Aucune carte disponible.`);
      return this.continueQueuedDraw(next, playerId, queue, depth);
    }

    next = this.core.appendLog(
      next,
      `${card.type.toUpperCase()} : ${card.title}. ${card.text}`,
    );

    if (card.type === 'conte') {
      return this.continueQueuedDraw(next, playerId, queue, depth);
    }
    if (card.type === 'bonus') {
      next = this.applyBonusEffectById(next, playerId, card.id, depth);
    } else if (card.type === 'malus') {
      next = this.applyMalusEffectById(next, playerId, card.id, depth);
    } else if (card.type === 'surprise') {
      next = this.applySurpriseEffectById(next, playerId, card.id, depth);
    }

    if (next.pending) return next;
    return this.continueQueuedDraw(next, playerId, queue, depth);
  }

  private continueQueuedDraw(
    state: GameStateEntity,
    playerId: number,
    queue: string[],
    depth: number,
  ): GameStateEntity {
    if (!queue.length) return state;
    return this.setPending(state, {
      type: 'draw',
      label: 'Piocher une carte (Espace).',
      playerId,
      blocking: true,
      data: {
        context: 'draw_and_apply',
        queue,
        depth,
      },
    });
  }

  private queueDraws(
    state: GameStateEntity,
    playerId: number,
    queue: Array<'bonus' | 'malus' | 'surprise' | 'conte'>,
    depth: number,
    label: string = 'Piocher une carte (Espace).',
  ): GameStateEntity {
    if (!queue.length) return state;
    return this.setPending(state, {
      type: 'draw',
      label,
      playerId,
      blocking: true,
      data: {
        context: 'draw_and_apply',
        queue,
        depth,
      },
    });
  }

  private resolveAbondanceDraw(
    state: GameStateEntity,
    playerId: number,
    data: { remaining?: number; drawn?: ContesCard[]; depth?: number },
  ): GameStateEntity {
    const remaining = Number.isFinite(data.remaining) ? Number(data.remaining) : 0;
    const drawn = Array.isArray(data.drawn) ? [...data.drawn] : [];
    if (remaining <= 0) return state;

    const draw = this.drawCard(state, 'bonus');
    let next = draw.state;
    if (draw.card) {
      drawn.push(draw.card);
    }

    if (remaining - 1 > 0) {
      return this.setPending(next, {
        type: 'draw',
        label: 'Corne d’abondance : piocher une carte Bonus (Espace).',
        playerId,
        blocking: true,
        data: {
          context: 'abondance',
          remaining: remaining - 1,
          drawn,
        },
      });
    }

    if (drawn.length === 0) return next;
    if (drawn.length === 1) {
      return this.applyBonusEffectById(next, playerId, drawn[0].id, 0);
    }

    return this.setPending(next, {
      type: 'choose_card',
      label:
        'Corne d’abondance : choisissez la carte Bonus à garder, puis Entrée.',
      playerId,
      blocking: true,
      choices: drawn.map((c) => c.title),
      data: {
        context: `abondance_keep_one:${playerId}`,
        cards: drawn.map((c) => ({
          cardType: 'bonus',
          cardId: c.id,
          title: c.title,
        })),
      },
    });
  }

  // --- Effects + helpers (added in next patches) ---

  private applyBonusEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    switch (id) {
      case 1:
        return this.moveBy(next, playerId, 2, depth);
      case 2:
        next = this.addStatusCount(next, 'rerollToken', playerId, 1);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} gagne un parchemin enchanté (1 relance).`,
        );
      case 3:
        next = this.addStatusCount(next, 'shieldMalus', playerId, 1);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} obtient une Amulette protectrice (1 protection).`,
        );
      case 4:
        next = this.setStatusBool(
          next,
          'ignoreNextConteAndAdvance',
          playerId,
          true,
        );
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} obtient une Cape d’invisibilité (prochaine case Conte ignorée).`,
        );
      case 5:
        return this.startChooseTarget(
          next,
          playerId,
          'move_other_2',
          'Poussière de fée : choisissez un joueur à faire avancer de 2 cases.',
        );
      case 6: {
        const out = this.random.rollDice(this.getMeta(next) as any, 6);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
        next = this.core.appendLog(
          next,
          `Haricot magique : dé \"${out.roll}\", doublé.`,
        );
        return this.moveBy(next, playerId, out.roll * 2, depth);
      }
      case 7:
        next = this.setStatusBool(next, 'keyOfGold', playerId, true);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} obtient la Clé d’or (sur Conte : Bonus/Malus pour un autre joueur).`,
        );
      case 8:
        return this.moveBy(next, playerId, 3, depth);
      case 9:
        return this.queueDraws(next, playerId, ['bonus', 'surprise'], depth);
      case 10:
        return this.startChooseTarget(
          next,
          playerId,
          'turn_swap_next',
          'Formule magique : choisissez un joueur pour échanger vos prochains tours.',
        );
      case 11: {
        const players = Array.isArray(next.players) ? next.players : [];
        for (const p of players) {
          if (p.id === playerId) continue;
          next = this.addStatusCount(next, 'forcedRollOneTurns', p.id, 1);
        }
        return this.core.appendLog(
          next,
          'Flûte enchantée : au prochain tour des autres joueurs, ils avancent d’1 case.',
        );
      }
      case 12:
        return this.applyAbondance(next, playerId);
      case 13:
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} avance de 5 cases mais passera son prochain tour.`,
        );
        next = this.moveBy(next, playerId, 5, depth);
        return this.addStatusCount(next, 'skipTurn', playerId, 1);
      case 14:
        next = this.setStatusBool(next, 'replaceOneOn1By4', playerId, true);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} pose Feuille magique (1 devient 4 une fois).`,
        );
      case 15:
        next = this.moveBy(next, playerId, -2, depth);
        return this.moveBy(next, playerId, 3, depth);
      default:
        return next;
    }
  }

  private applyMalusEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    switch (id) {
      case 1:
        return this.addStatusCount(next, 'skipTurn', playerId, 1);
      case 2:
        return this.moveBy(next, playerId, -2, depth);
      case 3:
        return this.swapWithClosestBehind(next, playerId);
      case 4: {
        const out = this.random.rollDice(this.getMeta(next) as any, 6);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
        const half = Math.floor(out.roll / 2);
        next = this.core.appendLog(
          next,
          `Pluie de mots oubliés : dé \"${out.roll}\", moitié = ${half}.`,
        );
        return this.moveBy(next, playerId, half, depth);
      }
      case 5:
        return this.blockUntilPassed(next, playerId);
      case 6:
        return this.addStatusCount(next, 'skipTurn', playerId, 2);
      case 7:
        return this.drawAndApply(next, playerId, 'malus', depth + 1);
      case 8:
        next = this.moveBy(next, playerId, 3, depth);
        return this.moveBy(next, playerId, -4, depth);
      case 9:
        return this.startChooseTarget(
          next,
          playerId,
          'give_bonus_choose_target',
          'Maladresse : choisissez un joueur à qui donner une de vos cartes Bonus.',
        );
      case 10: {
        const out = this.random.rollDice(this.getMeta(next) as any, 6);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
        next = this.core.appendLog(
          next,
          `Ombre farceuse : dé \"${out.roll}\", recul.`,
        );
        return this.moveBy(next, playerId, -out.roll, depth);
      }
      case 11: {
        const out = this.random.rollDice(this.getMeta(next) as any, 6);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
        if (out.roll >= 4)
          return this.core.appendLog(
            next,
            `Énigme infernale : \"${out.roll}\" (réussi).`,
          );
        next = this.core.appendLog(
          next,
          `Énigme infernale : \"${out.roll}\" (raté) : passez votre tour.`,
        );
        return this.addStatusCount(next, 'skipTurn', playerId, 1);
      }
      case 12:
        return this.goToPreviousMalusAndApply(next, playerId, depth);
      case 13:
        return this.moveBy(next, playerId, -2, depth);
      case 14:
        return this.teleport(next, playerId, 0);
      case 15:
        next = this.addStatusCount(next, 'noBonusCardsTurns', playerId, 2);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} ne peut plus utiliser de cartes Bonus pendant 2 tours.`,
        );
      default:
        return next;
    }
  }

  private applySurpriseEffectById(
    state: GameStateEntity,
    playerId: number,
    id: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    switch (id) {
      case 1:
        next = this.moveBy(next, playerId, 1, depth);
        return this.moveBy(next, playerId, -2, depth);
      case 2:
        return this.moveBy(next, playerId, 4, depth);
      case 3:
        return this.drawAndApply(next, playerId, 'bonus', depth);
      case 4:
        return this.applyCoffreMerveilles(next, playerId, depth);
      case 5:
        return this.setPending(next, {
          type: 'choose_number',
          label:
            'Poussière de rire : choisissez un nombre entre 1 et 3, puis Entrée.',
          playerId,
          blocking: true,
          choices: ['1', '2', '3'],
          data: { context: 'laughter_dust', min: 1, max: 3 },
        });
      case 6:
        return this.startChooseTarget(
          next,
          playerId,
          'swap_positions',
          'Tempête de pages : choisissez un joueur pour échanger vos positions.',
        );
      case 7:
        return this.addStatusCount(next, 'skipTurn', playerId, 1);
      case 8:
        next = this.setStatusBool(next, 'reverseNextTurn', playerId, true);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} lira à l’envers : prochain tour en reculant.`,
        );
      case 9:
        return this.setPending(next, {
          type: 'choose_option',
          label: 'Chanson enchantée : choisissez une option.',
          playerId,
          blocking: true,
          choices: ['Avancer de 3', 'Prendre une carte Bonus'],
          data: { context: 'song_choice' },
        });
      case 10:
        next = this.setStatusBool(next, 'protectNextMalus', playerId, true);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} est protégé(e) de la prochaine carte Malus.`,
        );
      case 11:
        return this.drawAndApply(next, playerId, 'conte', depth);
      case 12: {
        const out = this.random.rollDice(this.getMeta(next) as any, 6);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
        next = this.core.appendLog(
          next,
          `Montre enchantée : dé \"${out.roll}\", recul.`,
        );
        return this.moveBy(next, playerId, -out.roll, depth);
      }
      case 13:
        return this.setPending(next, {
          type: 'choose_option',
          label: 'Souhait éphémère : choisissez une option.',
          playerId,
          blocking: true,
          choices: ['Avancer de 2', 'Échanger', 'Tirer une carte Bonus'],
          data: { context: 'wish_ephemere' },
        });
      case 14:
        return this.startChooseTarget(
          next,
          playerId,
          'steal_bonus_or_surprise',
          'Filet magique : choisissez un joueur pour lui prendre une carte Bonus ou Surprise.',
        );
      case 15:
        return this.startChooseTarget(
          next,
          playerId,
          'grimoire_voyageur',
          'Grimoire voyageur : choisissez un joueur.',
        );
      default:
        return next;
    }
  }

  private applyAbondance(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return this.setPending(state, {
      type: 'draw',
      label: 'Corne d’abondance : piocher une carte Bonus (Espace).',
      playerId,
      blocking: true,
      data: {
        context: 'abondance',
        remaining: 2,
        drawn: [],
      },
    });
  }

  private applyCoffreMerveilles(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    const out1 = this.random.nextInt(this.getMeta(next) as any, 3);
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...out1.meta } };
    const out2 = this.random.nextInt(this.getMeta(next) as any, 3);
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...out2.meta } };
    const t = (v: number) =>
      v === 0 ? 'bonus' : v === 1 ? 'malus' : 'surprise';
    const t1 = t(out1.value);
    const t2 = t(out2.value);
    next = this.core.appendLog(
      next,
      `Coffre aux merveilles : 2 cartes (${t1}, ${t2}).`,
    );
    return this.queueDraws(next, playerId, [t1 as any, t2 as any], depth);
  }

  private drawCard(
    state: GameStateEntity,
    type: 'bonus' | 'malus' | 'surprise' | 'conte',
  ): { state: GameStateEntity; card: ContesCard | null } {
    const meta = this.getMeta(state);
    const decks = meta.decks;
    const pileKey = type;
    const discardKey =
      type === 'bonus'
        ? 'discardBonus'
        : type === 'malus'
          ? 'discardMalus'
          : type === 'surprise'
            ? 'discardSurprise'
            : 'discardContes';

    const pile: ContesCard[] = [...(decks[pileKey] ?? [])];
    const discard: ContesCard[] = [...((decks as any)[discardKey] ?? [])];

    let updatedMeta = meta;
    let drawPile = pile;

    if (drawPile.length === 0) {
      const defaults = [...discard];
      const shuffled = this.random.shuffle(updatedMeta as any, defaults);
      updatedMeta = { ...updatedMeta, ...shuffled.meta };
      drawPile = shuffled.values;
      discard.length = 0;
    }

    const card = drawPile.shift() ?? null;
    if (card) discard.push(card);

    const nextMeta = {
      ...updatedMeta,
      decks: {
        ...decks,
        [pileKey]: drawPile,
        [discardKey]: discard,
      } as any,
    } as ContesCacahuetesMetadata;

    return {
      state: { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } },
      card,
    };
  }

  private maybeProtectFromMalus(
    state: GameStateEntity,
    playerId: number,
  ): { protected: boolean; state: GameStateEntity } {
    let next = state;
    const meta = this.getMeta(next);

    const dragon = Boolean(meta.statuses.protectNextMalus?.[playerId]);
    if (dragon) {
      next = this.setStatusBool(next, 'protectNextMalus', playerId, false);
      return { protected: true, state: next };
    }

    const charges = Number(meta.statuses.shieldMalus?.[playerId] ?? 0);
    if (charges > 0) {
      next = this.setStatusCount(next, 'shieldMalus', playerId, charges - 1);
      return { protected: true, state: next };
    }

    return { protected: false, state: next };
  }

  private startChooseTarget(
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const targets = players
      .filter((p) => {
        const targetId = p?.id;
        if (targetId === playerId) return false;

        if (context === 'song_take_bonus' || context === 'steal_bonus') {
          return this.listBonusTokens(meta, targetId).length > 0;
        }

        if (context === 'steal_bonus_or_surprise') {
          return (
            this.listBonusTokens(meta, targetId).length > 0 ||
            this.listSurpriseTokens(meta, targetId).length > 0
          );
        }

        return true;
      })
      .map((p: any) => ({
        targetPlayerId: p.id,
        targetUsername: p.username ?? `Joueur ${p.id}`,
      }));
    if (!targets.length) {
      if (
        context === 'song_take_bonus' ||
        context === 'steal_bonus' ||
        context === 'steal_bonus_or_surprise'
      ) {
        return this.core.appendLog(
          state,
          'Aucune carte à voler chez les autres joueurs.',
        );
      }
      return this.core.appendLog(state, 'Aucun autre joueur disponible.');
    }
    return this.setPending(state, {
      type: 'choose_target',
      label,
      playerId,
      blocking: true,
      choices: targets.map((t) => t.targetUsername),
      data: { context, targets },
    });
  }

  private startGiveBonusChoice(
    state: GameStateEntity,
    giverId: number,
    targetId: number,
  ): GameStateEntity {
    const tokens = this.listBonusTokens(this.getMeta(state), giverId);
    if (!tokens.length) {
      return this.core.appendLog(
        state,
        `${this.playerName(state, giverId)} n'a aucune carte Bonus à donner.`,
      );
    }
    return this.setPending(state, {
      type: 'choose_card',
      label: `Choisissez la carte Bonus à donner à ${this.playerName(state, targetId)}, puis Entrée.`,
      playerId: giverId,
      blocking: true,
      choices: tokens.map((t) => t.title),
      data: {
        context: `give_bonus_to:${targetId}`,
        cards: tokens.map((t) => ({
          cardType: 'bonus',
          cardId: t.cardId,
          title: t.title,
        })),
      },
    });
  }

  private listBonusTokens(
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ): Array<{ cardId: number; title: string }> {
    const out: Array<{ cardId: number; title: string }> = [];
    const shield = Number(meta.statuses.shieldMalus?.[playerId] ?? 0);
    if (shield > 0)
      out.push({ cardId: 3, title: `Amulette protectrice (${shield})` });
    if (meta.statuses.ignoreNextConteAndAdvance?.[playerId])
      out.push({ cardId: 4, title: 'Cape d’invisibilité' });
    if (meta.statuses.keyOfGold?.[playerId])
      out.push({ cardId: 7, title: 'Clé d’or universelle' });
    if (meta.statuses.replaceOneOn1By4?.[playerId])
      out.push({ cardId: 14, title: 'Feuille magique' });
    const reroll = Number(meta.statuses.rerollToken?.[playerId] ?? 0);
    if (reroll > 0)
      out.push({ cardId: 2, title: `Parchemin enchanté (${reroll})` });
    return out;
  }

  private listSurpriseTokens(
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ): Array<{ cardId: number; title: string }> {
    const out: Array<{ cardId: number; title: string }> = [];
    if (meta.statuses.reverseNextTurn?.[playerId])
      out.push({ cardId: 8, title: 'Livre à l’envers' });
    if (meta.statuses.protectNextMalus?.[playerId])
      out.push({ cardId: 10, title: 'Dragon de papier' });
    return out;
  }

  private startStealTokenChoice(
    state: GameStateEntity,
    thiefId: number,
    fromId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const bonus = this.listBonusTokens(meta, fromId).map((t) => ({
      cardType: 'bonus' as const,
      cardId: t.cardId,
      title: t.title,
    }));
    const surprise = this.listSurpriseTokens(meta, fromId).map((t) => ({
      cardType: 'surprise' as const,
      cardId: t.cardId,
      title: t.title,
    }));
    const cards = [...bonus, ...surprise];

    if (!cards.length) {
      return this.core.appendLog(
        state,
        `${this.playerName(state, fromId)} n’a aucune carte Bonus ou Surprise à voler.`,
      );
    }

    if (cards.length === 1) {
      const only = cards[0];
      const next = this.core.appendLog(
        state,
        `Vol : ${this.playerName(state, thiefId)} prend "${only.title}" à ${this.playerName(state, fromId)}.`,
      );
      return only.cardType === 'bonus'
        ? this.transferBonusToken(next, fromId, thiefId, only.cardId)
        : this.transferSurpriseToken(next, fromId, thiefId, only.cardId);
    }

    return this.setPending(state, {
      type: 'choose_card',
      label: `Filet magique : choisissez la carte à voler à ${this.playerName(state, fromId)}, puis Entrée.`,
      playerId: thiefId,
      blocking: true,
      choices: cards.map((c) => c.title),
      data: {
        context: `steal_token_from:${fromId}:${thiefId}`,
        cards: cards.map((c) => ({
          cardType: c.cardType,
          cardId: c.cardId,
          title: c.title,
        })),
      },
    });
  }

  private transferBonusToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    bonusId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    if (bonusId === 3) {
      const shield = Number(meta.statuses.shieldMalus?.[fromId] ?? 0);
      if (shield <= 0) return next;
      next = this.setStatusCount(next, 'shieldMalus', fromId, shield - 1);
      next = this.addStatusCount(next, 'shieldMalus', toId, 1);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne une Amulette protectrice à ${this.playerName(next, toId)}.`,
      );
    }
    if (bonusId === 4) {
      if (!meta.statuses.ignoreNextConteAndAdvance?.[fromId]) return next;
      next = this.setStatusBool(
        next,
        'ignoreNextConteAndAdvance',
        fromId,
        false,
      );
      next = this.setStatusBool(next, 'ignoreNextConteAndAdvance', toId, true);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne une Cape d’invisibilité à ${this.playerName(next, toId)}.`,
      );
    }
    if (bonusId === 7) {
      if (!meta.statuses.keyOfGold?.[fromId]) return next;
      next = this.setStatusBool(next, 'keyOfGold', fromId, false);
      next = this.setStatusBool(next, 'keyOfGold', toId, true);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne la Clé d’or à ${this.playerName(next, toId)}.`,
      );
    }
    if (bonusId === 14) {
      if (!meta.statuses.replaceOneOn1By4?.[fromId]) return next;
      next = this.setStatusBool(next, 'replaceOneOn1By4', fromId, false);
      next = this.setStatusBool(next, 'replaceOneOn1By4', toId, true);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne Feuille magique à ${this.playerName(next, toId)}.`,
      );
    }
    if (bonusId === 2) {
      const reroll = Number(meta.statuses.rerollToken?.[fromId] ?? 0);
      if (reroll <= 0) return next;
      next = this.setStatusCount(next, 'rerollToken', fromId, reroll - 1);
      next = this.addStatusCount(next, 'rerollToken', toId, 1);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne un Parchemin enchanté à ${this.playerName(next, toId)}.`,
      );
    }
    return next;
  }

  private transferSurpriseToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
    surpriseId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);

    if (surpriseId === 8) {
      if (!meta.statuses.reverseNextTurn?.[fromId]) return next;
      next = this.setStatusBool(next, 'reverseNextTurn', fromId, false);
      next = this.setStatusBool(next, 'reverseNextTurn', toId, true);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne Livre à l’envers à ${this.playerName(next, toId)}.`,
      );
    }

    if (surpriseId === 10) {
      if (!meta.statuses.protectNextMalus?.[fromId]) return next;
      next = this.setStatusBool(next, 'protectNextMalus', fromId, false);
      next = this.setStatusBool(next, 'protectNextMalus', toId, true);
      return this.core.appendLog(
        next,
        `${this.playerName(next, fromId)} donne Dragon de papier à ${this.playerName(next, toId)}.`,
      );
    }

    return next;
  }

  private takeOneBonusToken(
    state: GameStateEntity,
    fromId: number,
    toId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const tokens = this.listBonusTokens(meta, fromId);
    if (!tokens.length) {
      return this.core.appendLog(
        state,
        `${this.playerName(state, fromId)} n'a aucune carte Bonus à donner.`,
      );
    }
    return this.transferBonusToken(state, fromId, toId, tokens[0].cardId);
  }

  private swapPositions(
    state: GameStateEntity,
    aId: number,
    bId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const positions = { ...(meta.positions ?? {}) };
    const a = positions[aId] ?? 0;
    const b = positions[bId] ?? 0;
    positions[aId] = b;
    positions[bId] = a;
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, positions },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, aId)} échange sa position avec ${this.playerName(next, bId)}.`,
    );
    return next;
  }

  private setTurnSwap(
    state: GameStateEntity,
    aId: number,
    bId: number,
  ): GameStateEntity {
    let next = state;
    next = this.setStatusCount(next, 'turnSwapWith', aId, bId);
    next = this.setStatusCount(next, 'turnSwapWith', bId, aId);
    next = this.setStatusCount(next, 'turnSwapRemaining', aId, 1);
    next = this.setStatusCount(next, 'turnSwapRemaining', bId, 1);
    return this.core.appendLog(
      next,
      `Formule magique : prochains tours ҩchangҩs entre ${this.playerName(next, aId)} et ${this.playerName(next, bId)}.`,
    );
  }

  private onAnyPlayerPassedBlocked(
    state: GameStateEntity,
    moverId: number,
    moverPos: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const blocked = { ...(meta.statuses.blockedUntilPassed ?? {}) };
    const toClear: number[] = [];
    for (const [k, threshold] of Object.entries(blocked)) {
      const pid = Number(k);
      if (!Number.isFinite(pid)) continue;
      if (pid === moverId) continue;
      if (typeof threshold !== 'number') continue;
      if (moverPos >= threshold) toClear.push(pid);
    }
    if (!toClear.length) return next;
    for (const pid of toClear) {
      delete blocked[pid];
      next = this.setStatusCount(next, 'skipTurn', pid, 0);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, pid)} n’est plus bloqué(e).`,
      );
    }
    return {
      ...next,
      metadata: {
        ...(next.metadata ?? {}),
        ...meta,
        statuses: { ...meta.statuses, blockedUntilPassed: blocked },
      },
    };
  }

  private setWinner(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const updated: ContesCacahuetesMetadata = { ...meta, winnerId: playerId };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...updated } };
  }

  private endTurn(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    next = this.decrementPerTurn(next, playerId, 'noBonusCardsTurns');
    const advanced = this.turns.advanceTurn(next);
    return this.applyTurnSwapIfNeeded(advanced);
  }

  private applyTurnSwapIfNeeded(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const current = state.turn?.currentPlayerId ?? null;
    if (current == null) return state;
    const swapWith = Number(meta.statuses.turnSwapWith?.[current] ?? 0);
    const remaining = Number(meta.statuses.turnSwapRemaining?.[current] ?? 0);
    if (!swapWith || remaining <= 0) return state;

    let next = this.setStatusCount(
      state,
      'turnSwapRemaining',
      current,
      remaining - 1,
    );
    next = {
      ...next,
      turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: swapWith },
    };

    const remA = Number(
      this.getMeta(next).statuses.turnSwapRemaining?.[current] ?? 0,
    );
    const remB = Number(
      this.getMeta(next).statuses.turnSwapRemaining?.[swapWith] ?? 0,
    );
    if (remA <= 0 && remB <= 0) {
      next = this.setStatusCount(next, 'turnSwapWith', current, 0);
      next = this.setStatusCount(next, 'turnSwapWith', swapWith, 0);
    }

    return next;
  }

  private swapWithClosestBehind(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const myPos = meta.positions?.[playerId] ?? 0;
    const players = Array.isArray(state.players) ? state.players : [];
    const behind = players
      .map((p) => p.id)
      .filter((id) => id !== playerId)
      .map((id) => ({ id, pos: meta.positions?.[id] ?? 0 }))
      .filter((x) => x.pos < myPos)
      .sort((a, b) => b.pos - a.pos);
    if (!behind.length)
      return this.core.appendLog(state, 'Aucun joueur derrière vous.');
    return this.swapPositions(state, playerId, behind[0].id);
  }

  private blockUntilPassed(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    let next = state;
    next = this.setStatusCount(next, 'blockedUntilPassed', playerId, pos);
    next = this.setStatusCount(next, 'skipTurn', playerId, 999);
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} est bloqué(e) jusqu’à ce qu’un autre joueur atteigne ou dépasse sa case.`,
    );
  }

  private goToPreviousMalusAndApply(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    let idx = -1;
    for (let i = pos - 1; i >= 0; i -= 1) {
      if (tiles[i]?.type === 'malus') {
        idx = i;
        break;
      }
    }
    if (idx < 0) return state;
    let next = this.teleport(state, playerId, idx);
    next = this.core.appendLog(
      next,
      `Passage obscur : retour à la case Malus ${idx + 1}.`,
    );
    return this.applyTileEffect(next, playerId, tiles[idx], depth + 1);
  }

  private teleport(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const clamped = Math.max(0, Math.min(pos, (meta.tiles?.length ?? 60) - 1));
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        positions: { ...(meta.positions ?? {}), [playerId]: clamped },
      },
    };
  }

  private autoSkipIfBlocked(
    state: GameStateEntity,
    currentId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const blocked = meta.statuses.blockedUntilPassed?.[currentId];
    if (typeof blocked !== 'number') return state;
    const msg = `${this.playerName(state, currentId)} est bloqué(e) (Loup dans la forêt) : tour passé.`;
    const logged = this.core.appendLog(state, msg);
    const advanced = this.turns.advanceTurn(logged);
    return this.applyTurnSwapIfNeeded(advanced);
  }

  private canUseBonusCards(state: GameStateEntity, playerId: number): boolean {
    const meta = this.getMeta(state);
    const turns = Number(meta.statuses.noBonusCardsTurns?.[playerId] ?? 0);
    return !(Number.isFinite(turns) && turns > 0);
  }

  private decrementPerTurn(
    state: GameStateEntity,
    playerId: number,
    key: keyof ContesCacahuetesMetadata['statuses'],
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const current = Number(meta.statuses?.[key]?.[playerId] ?? 0);
    if (!Number.isFinite(current) || current <= 0) return state;
    return this.setStatusCount(state, String(key), playerId, current - 1);
  }

  private setPending(
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ): GameStateEntity {
    return { ...state, pending };
  }

  private setStatusCount(
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? {};
    const map = { ...(statuses[key] ?? {}) };
    if (!value) delete map[playerId];
    else map[playerId] = value;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, [key]: map },
      },
    };
  }

  private setStatusBool(
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? {};
    const map = { ...(statuses[key] ?? {}) };
    if (!value) delete map[playerId];
    else map[playerId] = true;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, [key]: map },
      },
    };
  }

  private addStatusCount(
    state: GameStateEntity,
    key: string,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? {};
    const map = { ...(statuses[key] ?? {}) };
    const current = Number(map[playerId] ?? 0);
    map[playerId] = (Number.isFinite(current) ? current : 0) + delta;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, [key]: map },
      },
    };
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x) => x?.id === id);
    const u =
      p?.username && String(p.username).trim()
        ? String(p.username).trim()
        : null;
    return u ?? `Joueur ${id}`;
  }

  private getMeta(state: GameStateEntity): ContesCacahuetesMetadata {
    return (state.metadata ?? {}) as any as ContesCacahuetesMetadata;
  }
}
