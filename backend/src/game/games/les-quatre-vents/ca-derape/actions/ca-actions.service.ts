import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import type { CaCard, CaMetadata } from '../model/ca.types';

type PendingContext =
  | { kind: 'swap_after_move'; actorId: number }
  | { kind: 'choose_next_player'; actorId: number }
  | { kind: 'choose_next_delta'; actorId: number }
  | { kind: 'mirror_next_roll'; actorId: number }
  | null;

@Injectable()
export class CaActionService {
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
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
        continue;
      }
      if (type === 'choose_next_player') {
        next = this.handleChooseNextPlayer(next, action);
        continue;
      }
      if (type === 'choose_next_delta') {
        next = this.handleChooseNextDelta(next, action);
        continue;
      }
      if (type === 'choose_target') {
        // choose_target also handles mirror roll when pendingContext=mirror_next_roll
        continue;
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);

    // "Ton prochain lancer devient égal au sien."
    const mirrorFrom = meta.statuses?.mirrorNextRollFrom?.[currentId] ?? null;
    let mirrorApplied = false;
    let roll: number;
    if (typeof mirrorFrom === 'number') {
      const mirrored = meta.lastRollByPlayer?.[mirrorFrom] ?? null;
      if (typeof mirrored === 'number' && mirrored > 0) {
        roll = mirrored;
        mirrorApplied = true;
      } else {
        roll = 0;
      }
    } else {
      roll = 0;
    }

    if (roll <= 0) {
      const rng = this.random.rollDice(meta as any, 6);
      meta = { ...meta, ...rng.meta };
      roll = rng.roll;
    }

    if (meta.statuses?.doubleNextRoll?.[currentId]) {
      roll *= 2;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          doubleNextRoll: {
            ...(meta.statuses.doubleNextRoll ?? {}),
            [currentId]: false,
          },
        },
      };
    }

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
      lastRoll: roll,
    };

    // Keep last roll per player for mirroring.
    meta = this.getMeta(next);
    meta = {
      ...meta,
      lastRollByPlayer: { ...(meta.lastRollByPlayer ?? {}), [currentId]: roll },
      statuses: {
        ...meta.statuses,
        mirrorNextRollFrom: {
          ...(meta.statuses?.mirrorNextRollFrom ?? {}),
          [currentId]: mirrorApplied
            ? null
            : (meta.statuses?.mirrorNextRollFrom?.[currentId] ?? null),
        },
      } as any,
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    const drawOut = this.drawCard(this.getMeta(next));
    meta = drawOut.meta;
    const card = drawOut.card;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    if (card) {
      next = this.core.appendLog(next, `Carte : ${card.title}. ${card.text}`);
      next = this.applyCardEffects(next, currentId, card, roll);
    }

    meta = this.getMeta(next);
    if (meta.winnerId != null) {
      return { ...next, status: 'finished' };
    }

    if (next.pending) return next;

    const keepTurn = Boolean(card?.keepTurn);
    if (keepTurn)
      return this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} rejoue.`,
      );

    const override =
      (this.getMeta(next).pendingContext as PendingContext) ?? null;
    if (
      override &&
      (override.kind === 'choose_next_player' ||
        override.kind === 'choose_next_delta' ||
        override.kind === 'mirror_next_roll')
    ) {
      return next;
    }

    return this.advanceTurnWithNextDelta(next);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (
      !pending ||
      pending.type !== 'choose_target' ||
      pending.playerId !== currentId
    )
      return state;

    const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) return state;

    let meta = this.getMeta(state);
    const context = (meta.pendingContext as PendingContext) ?? null;
    if (!context || context.actorId !== currentId)
      return { ...state, pending: null };

    if (context.kind === 'swap_after_move') {
      const actorPos = meta.positions?.[currentId] ?? 0;
      const targetPos = meta.positions?.[targetPlayerId] ?? 0;
      meta = {
        ...meta,
        positions: {
          ...(meta.positions ?? {}),
          [currentId]: targetPos,
          [targetPlayerId]: actorPos,
        },
        pendingContext: null,
      };
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} échange sa position avec ${this.playerName(next, targetPlayerId)}.`,
      );
      return this.advanceTurnWithNextDelta(next);
    }

    if (context.kind === 'mirror_next_roll') {
      meta = {
        ...meta,
        pendingContext: null,
        statuses: {
          ...meta.statuses,
          mirrorNextRollFrom: {
            ...(meta.statuses?.mirrorNextRollFrom ?? {}),
            [currentId]: targetPlayerId,
          },
        } as any,
      };
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} copiera le prochain lancer de ${this.playerName(next, targetPlayerId)}.`,
      );
      return this.advanceTurnWithNextDelta(next);
    }

    return { ...state, pending: null };
  }

  private handleChooseNextPlayer(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (
      !pending ||
      pending.type !== 'choose_next_player' ||
      pending.playerId !== currentId
    )
      return state;

    const playerId = Number((action.payload as any)?.playerId);
    if (!Number.isFinite(playerId)) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    const idx = players.findIndex((p) => p?.id === playerId);
    if (idx < 0) return state;

    let meta = this.getMeta(state);
    meta = { ...meta, pendingContext: null };
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `Prochain joueur choisi : ${this.playerName(next, playerId)}.`,
    );
    return {
      ...next,
      turnIndex: idx,
      turn: { currentPlayerId: playerId, direction: 1 },
    };
  }

  private handleChooseNextDelta(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (
      !pending ||
      pending.type !== 'choose_next_delta' ||
      pending.playerId !== currentId
    )
      return state;
    const delta = Number((action.payload as any)?.delta);
    if (!Number.isFinite(delta) || (delta !== -1 && delta !== 1))
      return { ...state, pending: null };

    let meta = this.getMeta(state);
    meta = {
      ...meta,
      pendingContext: null,
      statuses: { ...meta.statuses, nextPlayerDelta: delta } as any,
    };
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `Effet : le prochain joueur aura un déplacement ${delta > 0 ? '+1' : '-1'}.`,
    );
    return this.advanceTurnWithNextDelta(next);
  }

  private applyCardEffects(
    state: GameStateEntity,
    actorId: number,
    card: CaCard,
    roll: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    // Stats de mouvement pour les conditionnels.
    const bumpTurnStats = (didMove: boolean, delta: number) => {
      const updatedSince = { ...(meta.turnsSinceMoved ?? {}) };
      const updatedLast = { ...(meta.lastMoveDelta ?? {}) };
      for (const p of Object.keys(updatedSince)) {
        const pid = Number(p);
        if (!Number.isFinite(pid)) continue;
        updatedSince[pid] = (updatedSince[pid] ?? 0) + 1;
      }
      updatedSince[actorId] = didMove ? 0 : (updatedSince[actorId] ?? 0);
      updatedLast[actorId] = delta;
      meta = {
        ...meta,
        turnsSinceMoved: updatedSince,
        lastMoveDelta: updatedLast,
      };
    };

    if (card.kind === 'neutral') {
      bumpTurnStats(false, 0);
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (card.kind === 'global') {
      next = this.applyGlobal(next, actorId, card);
      meta = this.getMeta(next);
    }

    // Règles idiotes : effets permanents.
    if (
      card.kind === 'rule' &&
      /prochain déplacement est doubl/i.test(card.text)
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          doubleNextMove: {
            ...(meta.statuses.doubleNextMove ?? {}),
            [actorId]: true,
          },
        },
      };
    }
    if (card.kind === 'rule' && /prochain recul est ignor/i.test(card.text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextPenalty: {
            ...(meta.statuses.ignoreNextPenalty ?? {}),
            [actorId]: true,
          },
        },
      };
    }
    if (
      card.kind === 'rule' &&
      /prochain lancer.*compte double/i.test(card.text)
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          doubleNextRoll: {
            ...(meta.statuses.doubleNextRoll ?? {}),
            [actorId]: true,
          },
        },
      };
    }

    // "Choisis un joueur : ton prochain lancer devient égal au sien."
    if (card.kind === 'rule' && /devient égal au sien/i.test(card.text)) {
      const targets = this.otherPlayers(next, actorId);
      if (targets.length) {
        const pending: PendingState = {
          type: 'choose_target',
          label: 'Choisissez un joueur dans la liste, puis Entrée.',
          playerId: actorId,
          blocking: true,
          choices: targets.map((t) => t.username),
          data: {
            context: 'mirror_next_roll',
            targets: targets.map((t) => ({
              targetPlayerId: t.id,
              targetUsername: t.username,
            })),
          },
        };
        meta = {
          ...meta,
          pendingContext: {
            kind: 'mirror_next_roll',
            actorId,
          } satisfies PendingContext,
        };
        return {
          ...next,
          pending,
          metadata: { ...(next.metadata ?? {}), ...meta },
        };
      }
    }

    if (card.kind === 'skip') {
      const ignore = meta.statuses?.ignoreNextPenalty?.[actorId] === true;
      if (ignore) {
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            ignoreNextPenalty: {
              ...(meta.statuses.ignoreNextPenalty ?? {}),
              [actorId]: false,
            },
          },
        };
        next = this.core.appendLog(next, 'Pénalité ignorée.');
      } else {
        const curr = meta.statuses?.skipTurn?.[actorId] ?? 0;
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: {
              ...(meta.statuses.skipTurn ?? {}),
              [actorId]: curr + 1,
            },
          },
        };
      }
    }

    if (card.kind === 'conditional') {
      next = this.applyConditional(next, actorId, card);
      meta = this.getMeta(next);
    }

    // Règles idiotes : roll supplémentaire / pioche supplémentaire.
    let baseRoll = roll;
    if (card.kind === 'rule' && /lancer le dé deux fois/i.test(card.text)) {
      const extra = this.random.rollDice(meta as any, 6);
      meta = { ...meta, ...extra.meta };
      baseRoll = roll + extra.roll;
      next = this.core.appendLog(
        next,
        `Règle : second dé = "${extra.roll}". Total = "${baseRoll}".`,
      );
    }

    if (card.kind === 'rule' && /^Pioche une carte/i.test(card.text)) {
      const draw2 = this.drawCard(meta);
      meta = draw2.meta;
      if (draw2.card) {
        next = this.core.appendLog(
          next,
          `Carte supplémentaire : ${draw2.card.title}. ${draw2.card.text}`,
        );
        next = this.applyCardEffects(
          { ...next, metadata: { ...(next.metadata ?? {}), ...meta } },
          actorId,
          draw2.card,
          baseRoll,
        );
        return next;
      }
    }

    // Mouvement combiné (dé + delta carte).
    let baseMove = roll;
    if (card.moveDelta === 0 && /Pas de déplacement/i.test(card.text)) {
      baseMove = 0;
    }
    let delta = card.moveDelta ?? 0;
    baseMove = baseRoll;

    // Recule/avance en deux temps (net), fidélité simple.
    if (
      card.kind === 'rule' &&
      /Recule de 3 cases puis avance de 2/i.test(card.text)
    ) {
      delta = -1;
    }
    if (
      card.kind === 'rule' &&
      /Avance de 3 cases puis recule de 1/i.test(card.text)
    ) {
      delta = 2;
    }

    let combined = baseMove + delta;

    if (meta.statuses?.doubleNextMove?.[actorId]) {
      combined *= 2;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          doubleNextMove: {
            ...(meta.statuses.doubleNextMove ?? {}),
            [actorId]: false,
          },
        },
      };
    }

    if (combined !== 0) {
      // Ignore prochain recul/penalité si un recul doit s'appliquer.
      const ignorePenalty =
        meta.statuses?.ignoreNextPenalty?.[actorId] === true;
      if (ignorePenalty && combined < 0) {
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            ignoreNextPenalty: {
              ...(meta.statuses.ignoreNextPenalty ?? {}),
              [actorId]: false,
            },
          },
        };
        next = this.core.appendLog(next, 'Pénalité ignorée.');
        combined = 0;
      }

      const before = meta.positions?.[actorId] ?? 0;
      const after = clamp(before + combined, 0, meta.tiles.length - 1);
      meta = {
        ...meta,
        positions: { ...(meta.positions ?? {}), [actorId]: after },
      };
      const casesWord = Math.abs(combined) === 1 ? 'case' : 'cases';
      const verb = combined >= 0 ? 'avance' : 'recule';
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} ${verb} de ${Math.abs(combined)} ${casesWord}.`,
      );
      bumpTurnStats(true, combined);
    } else {
      bumpTurnStats(false, 0);
    }

    // Effets spéciaux après mouvement (fidélité).
    next = this.applySpecialAfterMove(next, actorId, card);
    meta = this.getMeta(next);
    if (meta.winnerId != null) return next;
    if (next.pending) return next;

    // Pending swap / choose next player / choose next delta.
    if (card.kind === 'swap') {
      const targets = this.otherPlayers(next, actorId);
      if (targets.length) {
        const pending: PendingState = {
          type: 'choose_target',
          label: 'Choisissez un joueur dans la liste, puis Entrée.',
          playerId: actorId,
          blocking: true,
          choices: targets.map((t) => t.username),
          data: {
            context: 'swap',
            targets: targets.map((t) => ({
              targetPlayerId: t.id,
              targetUsername: t.username,
            })),
          },
        };
        meta = {
          ...meta,
          pendingContext: {
            kind: 'swap_after_move',
            actorId,
          } satisfies PendingContext,
        };
        return {
          ...next,
          pending,
          metadata: { ...(next.metadata ?? {}), ...meta },
        };
      }
    }

    if (card.kind === 'rule' && /choisis qui joue/i.test(card.text)) {
      const players = this.otherPlayers(next, actorId);
      const ids = players.map((p) => p.id);
      const pending: PendingState = {
        type: 'choose_next_player',
        label: 'Choisissez le prochain joueur dans la liste, puis Entrée.',
        playerId: actorId,
        blocking: true,
        choices: players.map((p) => p.username),
        data: { playerIds: ids },
      };
      meta = {
        ...meta,
        pendingContext: {
          kind: 'choose_next_player',
          actorId,
        } satisfies PendingContext,
      };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    if (
      card.kind === 'rule' &&
      /tu décides si le prochain joueur/i.test(card.text)
    ) {
      const pending: PendingState = {
        type: 'choose_next_delta',
        label:
          'Choisissez l’effet pour le prochain joueur dans la liste, puis Entrée.',
        playerId: actorId,
        blocking: true,
        choices: ['Avancer de 1', 'Reculer de 1'],
        data: { deltas: [1, -1] },
      };
      meta = {
        ...meta,
        pendingContext: {
          kind: 'choose_next_delta',
          actorId,
        } satisfies PendingContext,
      };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    // Victoire.
    if ((meta.positions?.[actorId] ?? 0) >= meta.tiles.length - 1) {
      meta = { ...meta, winnerId: actorId };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} remporte la partie !`,
      );
    }

    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  private applyGlobal(
    state: GameStateEntity,
    actorId: number,
    card: CaCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const players = Array.isArray(next.players) ? next.players : [];
    const ids = players.map((p) => p.id);
    const positions = { ...(meta.positions ?? {}) };

    if (card.id === 41) {
      const vals = ids.map((id) => positions[id] ?? 0);
      const shuffled = this.random.shuffle(meta as any, vals);
      meta = { ...meta, ...shuffled.meta };
      ids.forEach((id, i) => (positions[id] = shuffled.values[i] ?? 0));
      next = this.core.appendLog(next, 'Chaos : les positions sont mélangées.');
    } else if (card.id === 42) {
      const ranked = [...ids].sort(
        (a, b) => (positions[a] ?? 0) - (positions[b] ?? 0),
      );
      const reversed = [...ranked].reverse();
      ranked.forEach((id, i) => (positions[id] = positions[reversed[i]] ?? 0));
      next = this.core.appendLog(next, 'Chaos : ordre du classement inversé.');
    } else if (card.id === 43) {
      const skip = { ...(meta.statuses?.skipTurn ?? {}) };
      ids.forEach((id) => (skip[id] = (skip[id] ?? 0) + 1));
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      next = this.core.appendLog(
        next,
        'Tour commun perdu : tout le monde passe son prochain tour.',
      );
    } else if (card.id === 44) {
      ids.forEach(
        (id) =>
          (positions[id] = clamp(
            (positions[id] ?? 0) + 1,
            0,
            meta.tiles.length - 1,
          )),
      );
    } else if (card.id === 45) {
      ids.forEach(
        (id) =>
          (positions[id] = clamp(
            (positions[id] ?? 0) - 2,
            0,
            meta.tiles.length - 1,
          )),
      );
    } else if (card.id === 46) {
      next = this.core.appendLog(next, "Rien n'arrive.");
    } else if (card.id === 47) {
      const skip = { ...(meta.statuses?.skipTurn ?? {}) };
      ids.forEach((id) => (skip[id] = (skip[id] ?? 0) + 1));
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      next = this.core.appendLog(
        next,
        'Tout le monde passe son prochain tour.',
      );
    } else if (card.id === 48) {
      ids.forEach(
        (id) =>
          (positions[id] = clamp(
            (positions[id] ?? 0) + 2,
            0,
            meta.tiles.length - 1,
          )),
      );
    } else if (card.id === 49) {
      const ranked = [...ids].sort(
        (a, b) => (positions[a] ?? 0) - (positions[b] ?? 0),
      );
      const shifted = ranked.map(
        (_, i) => ranked[(i - 1 + ranked.length) % ranked.length],
      );
      ranked.forEach((id, i) => (positions[id] = positions[shifted[i]] ?? 0));
    } else if (card.id === 50) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} rejoue.`,
      );
    }

    meta = { ...meta, positions };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  private applyConditional(
    state: GameStateEntity,
    actorId: number,
    card: CaCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const positions = meta.positions ?? {};
    const ids = Object.keys(positions).map(Number).filter(Number.isFinite);
    const ordered = [...ids].sort(
      (a, b) => (positions[a] ?? 0) - (positions[b] ?? 0),
    );
    const leader = ordered[ordered.length - 1] ?? actorId;
    const last = ordered[0] ?? actorId;
    const myPos = positions[actorId] ?? 0;
    const myIndex = ordered.indexOf(actorId);

    const applyMove = (delta: number) => {
      const after = clamp(myPos + delta, 0, meta.tiles.length - 1);
      meta = { ...meta, positions: { ...positions, [actorId]: after } };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      if (delta !== 0) {
        const casesWord = Math.abs(delta) === 1 ? 'case' : 'cases';
        const verb = delta >= 0 ? 'avance' : 'recule';
        next = this.core.appendLog(
          next,
          `${this.playerName(next, actorId)} ${verb} de ${Math.abs(delta)} ${casesWord} (condition).`,
        );
      }
    };

    const text = card.text.toLowerCase();
    if (text.includes('en tête')) {
      applyMove(actorId === leader ? -2 : 2);
    } else if (text.includes('dernier')) {
      applyMove(actorId === last ? 3 : 0);
    } else if (text.includes('viens de reculer')) {
      const lastDelta = meta.lastMoveDelta?.[actorId] ?? 0;
      applyMove(lastDelta < 0 ? 3 : 0);
    } else if (text.includes('attendre un tour')) {
      const remaining = meta.statuses?.skipTurn?.[actorId] ?? 0;
      if (remaining > 0) {
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: {
              ...(meta.statuses.skipTurn ?? {}),
              [actorId]: Math.max(0, remaining - 1),
            },
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          'Condition : un tour d’attente est annulé.',
        );
      }
    } else if (text.includes('multiple de 5')) {
      const caseNumber = myPos + 1;
      const isMultiple = caseNumber % 5 === 0;
      applyMove(isMultiple ? 4 : -1);
    } else if (text.includes('pas bougé depuis 2')) {
      const tsm = meta.turnsSinceMoved?.[actorId] ?? 0;
      applyMove(tsm >= 2 ? 5 : 0);
    } else if (text.includes('à égalité')) {
      const same = ids.find(
        (id) => id !== actorId && (positions[id] ?? 0) === myPos,
      );
      if (same != null) {
        const aAfter = clamp(myPos + 2, 0, meta.tiles.length - 1);
        const sAfter = clamp(
          (positions[same] ?? 0) + 2,
          0,
          meta.tiles.length - 1,
        );
        meta = {
          ...meta,
          positions: { ...positions, [actorId]: aAfter, [same]: sAfter },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `Condition : ${this.playerName(next, actorId)} et ${this.playerName(next, same)} avancent de 2 cases.`,
        );
      }
    } else if (text.includes('rejoue immédiatement')) {
      // Indiqué au niveau du deck via keepTurn, mais au cas où.
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} rejoue.`,
      );
    } else if (text.includes('derrière quelqu’un') && text.includes('1 case')) {
      const aheadId = ordered[myIndex + 1];
      if (aheadId != null && (positions[aheadId] ?? 0) === myPos + 1) {
        meta = {
          ...meta,
          positions: { ...positions, [actorId]: positions[aheadId] ?? myPos },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `Condition : ${this.playerName(next, actorId)} rejoint ${this.playerName(next, aheadId)}.`,
        );
      }
    }

    return next;
  }

  private applySpecialAfterMove(
    state: GameStateEntity,
    actorId: number,
    card: CaCard,
  ): GameStateEntity {
    if (!card) return state;
    let next = state;
    let meta = this.getMeta(next);
    const myPos = meta.positions?.[actorId] ?? 0;
    const lastIndex = Math.max(0, (meta.tiles?.length ?? 0) - 1);

    const ids = Object.keys(meta.positions ?? {})
      .map(Number)
      .filter(Number.isFinite);
    const others = ids.filter((id) => id !== actorId);
    const maxPos = others.length
      ? Math.max(...others.map((id) => meta.positions?.[id] ?? 0))
      : myPos;

    if (card.id === 33) {
      const target = clamp(maxPos + 1, 0, lastIndex);
      meta = {
        ...meta,
        positions: { ...(meta.positions ?? {}), [actorId]: target },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} prend la première place.`,
      );
      return next;
    }
    if (card.id === 35) {
      const ahead = others
        .map((id) => ({ id, pos: meta.positions?.[id] ?? 0 }))
        .filter((x) => x.pos > myPos)
        .sort((a, b) => a.pos - b.pos)[0];
      if (!ahead) return next;
      const target = clamp(ahead.pos + 1, 0, lastIndex);
      meta = {
        ...meta,
        positions: { ...(meta.positions ?? {}), [actorId]: target },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} dépasse ${this.playerName(next, ahead.id)}.`,
      );
      return next;
    }
    if (card.id === 36) {
      const nextMultiple = (() => {
        for (let p = myPos + 1; p <= lastIndex; p += 1) {
          if ((p + 1) % 5 === 0) return p;
        }
        return lastIndex;
      })();
      meta = {
        ...meta,
        positions: { ...(meta.positions ?? {}), [actorId]: nextMultiple },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, actorId)} avance jusqu'à une case multiple de 5.`,
      );
      return next;
    }
    if (card.id === 34) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextPenalty: {
            ...(meta.statuses.ignoreNextPenalty ?? {}),
            [actorId]: true,
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    return next;
  }

  private advanceTurnWithNextDelta(state: GameStateEntity): GameStateEntity {
    const advanced = this.turns.advanceTurn(state);
    const nextId = advanced.turn?.currentPlayerId ?? null;
    if (nextId == null) return advanced;

    let meta = this.getMeta(advanced);
    const delta = meta.statuses?.nextPlayerDelta ?? null;
    if (typeof delta !== 'number' || delta === 0) return advanced;

    const before = meta.positions?.[nextId] ?? 0;
    const after = clamp(before + delta, 0, (meta.tiles?.length ?? 1) - 1);
    meta = {
      ...meta,
      statuses: { ...meta.statuses, nextPlayerDelta: null } as any,
      positions: { ...(meta.positions ?? {}), [nextId]: after },
    };
    let nextState: GameStateEntity = {
      ...advanced,
      metadata: { ...(advanced.metadata ?? {}), ...meta },
    };
    nextState = this.core.appendLog(
      nextState,
      `${this.playerName(nextState, nextId)} ${delta > 0 ? 'avance' : 'recule'} de 1 case (effet).`,
    );
    return nextState;
  }

  private drawCard(meta: CaMetadata): {
    card: CaCard | null;
    meta: CaMetadata;
  } {
    const deck = Array.isArray(meta.decks?.cards) ? meta.decks.cards : [];
    const discard = Array.isArray(meta.decks?.discard)
      ? meta.decks.discard
      : [];
    if (!deck.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const nextMeta = {
        ...meta,
        ...shuffled.meta,
        decks: { cards: shuffled.values, discard: [] },
      };
      return this.drawCard(nextMeta);
    }
    if (!deck.length) return { card: null, meta };
    const [card, ...rest] = deck;
    const next: CaMetadata = {
      ...meta,
      decks: { cards: rest, discard: [...discard, card] },
    };
    return { card, meta: next };
  }

  private getMeta(state: GameStateEntity): CaMetadata {
    return (state.metadata ?? {}) as any as CaMetadata;
  }

  private otherPlayers(
    state: GameStateEntity,
    me: number,
  ): Array<{ id: number; username: string }> {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((p) => p?.id != null && p.id !== me)
      .map((p) => ({ id: p.id, username: this.playerName(state, p.id) }));
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
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
