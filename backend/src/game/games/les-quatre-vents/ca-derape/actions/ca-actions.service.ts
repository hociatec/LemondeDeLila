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
      if (type === 'draw') {
        next = this.handleDraw(next);
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
    }
    return finalize(next);
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
    let roll = 0;

    if (typeof mirrorFrom === 'number') {
      const mirrored = meta.lastRollByPlayer?.[mirrorFrom] ?? null;
      if (typeof mirrored === 'number' && mirrored > 0) {
        roll = mirrored;
        mirrorApplied = true;
      }
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

    // Apply +/-1 effect for this player (set by previous player's card).
    const deltaFromPrevious =
      typeof meta.statuses?.nextPlayerDelta === 'number'
        ? meta.statuses.nextPlayerDelta
        : 0;
    if (deltaFromPrevious !== 0) {
      meta = {
        ...meta,
        statuses: { ...meta.statuses, nextPlayerDelta: null } as any,
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
      this.playerName(next, currentId) + ' lance le dé : "' + String(roll) + '".',
    );

    // Move by roll, plus optional +/-1.
    meta = this.getMeta(next);
    let move = roll + deltaFromPrevious;

    if (deltaFromPrevious !== 0) {
      next = this.core.appendLog(
        next,
        'Effet : déplacement ' + (deltaFromPrevious > 0 ? '+1' : '-1') + ' appliqué au lancer.',
      );
    }

    // "Votre prochain déplacement est doublé." (applies to the next roll movement).
    if (meta.statuses?.doubleNextMove?.[currentId]) {
      move *= 2;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          doubleNextMove: {
            ...(meta.statuses.doubleNextMove ?? {}),
            [currentId]: false,
          },
        },
      };
    }

    const before = meta.positions?.[currentId] ?? 0;
    const after = clamp(before + move, 0, meta.tiles.length - 1);
    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [currentId]: after },
    };

    // Update movement stats used by conditionals.
    const updatedSince = { ...(meta.turnsSinceMoved ?? {}) };
    const updatedLast = { ...(meta.lastMoveDelta ?? {}) };
    for (const p of Object.keys(updatedSince)) {
      const pid = Number(p);
      if (!Number.isFinite(pid)) continue;
      updatedSince[pid] = (updatedSince[pid] ?? 0) + 1;
    }
    updatedSince[currentId] = move !== 0 ? 0 : (updatedSince[currentId] ?? 0);
    updatedLast[currentId] = move;
    meta = { ...meta, turnsSinceMoved: updatedSince, lastMoveDelta: updatedLast };

    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    if (move !== 0) {
      const casesWord = Math.abs(move) === 1 ? 'case' : 'cases';
      const verb = move >= 0 ? 'avance' : 'recule';
      next = this.core.appendLog(
        next,
        this.playerName(next, currentId) + ' ' + verb + ' de ' + String(Math.abs(move)) + ' ' + casesWord + '.',
      );
    } else {
      next = this.core.appendLog(next, this.playerName(next, currentId) + ' ne se déplace pas.');
    }

    // Landing tile info (neutral vs card).
    meta = this.getMeta(next);
    const tile = meta.tiles?.[after] as any;
    const label = String(tile?.label ?? '').trim();
    const desc = String(tile?.description ?? '').trim();
    const isNeutral = Boolean(tile?.isNeutral);

    next = this.core.appendLog(
      next,
      this.playerName(next, currentId) +
        ' arrive sur Case ' +
        String(after + 1) +
        (label ? ' - ' + label : '') +
        (isNeutral ? ' (neutre).' : ' (carte).'),
    );
    if (desc) {
      next = this.core.appendLog(next, desc);
    }

    // Victory.
    if (after >= meta.tiles.length - 1) {
      meta = { ...meta, winnerId: currentId };
      next = this.core.appendLog(next, this.playerName(next, currentId) + ' remporte la partie !');
      return {
        ...next,
        status: 'finished',
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    if (isNeutral) {
      return this.advanceTurnWithNextDelta(next);
    }

    // Card draw is mandatory on non-neutral tiles.
    return {
      ...next,
      pending: {
        type: 'draw',
        playerId: currentId,
        blocking: true,
        label: 'Piocher une carte (Espace).',
        data: { landedPos: after },
      },
    };
  }


  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    let next: GameStateEntity = { ...state, pending: null };
    let meta = this.getMeta(next);

    const drawOut = this.drawCard(meta);
    meta = drawOut.meta;
    const card = drawOut.card;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    if (!card) {
      next = this.core.appendLog(next, 'Pioche vide.');
      return this.advanceTurnWithNextDelta(next);
    }

    next = this.core.appendLog(
      next,
      this.playerName(next, playerId) + ' pioche : "' + String(card.title) + '".',
    );
    if (card.text) {
      next = this.core.appendLog(next, String(card.text));
    }

    next = this.applyCardEffects(next, playerId, card);

    meta = this.getMeta(next);
    if (meta.winnerId != null) {
      return { ...next, status: 'finished' };
    }

    if (next.pending) return next;

    const override = (this.getMeta(next).pendingContext as PendingContext) ?? null;
    if (
      override &&
      (override.kind === 'choose_next_player' ||
        override.kind === 'choose_next_delta' ||
        override.kind === 'mirror_next_roll')
    ) {
      return finalize(next);
    }

    // Règle: après une carte résolue, le tour passe au joueur suivant.
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
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    const lastIndex = Math.max(0, (meta.tiles?.length ?? 0) - 1);
    let movedByCard = false;
    let lastLandingPos: number | null = null;
    let lastLandingIsNeutral = true;

    const logLanding = (pos: number) => {
      const tile = meta.tiles?.[pos] as any;
      const label = String(tile?.label ?? '').trim();
      const desc = String(tile?.description ?? '').trim();
      const isNeutral = Boolean(tile?.isNeutral);
      lastLandingPos = pos;
      lastLandingIsNeutral = isNeutral;
      next = this.core.appendLog(
        next,
        this.playerName(next, actorId) +
          ' arrive sur Case ' +
          String(pos + 1) +
          (label ? ' - ' + label : '') +
          (isNeutral ? ' (neutre).' : ' (carte).'),
      );
      if (desc) {
        next = this.core.appendLog(next, desc);
      }
    };

    const finalize = (state: GameStateEntity): GameStateEntity => {
      const finalMeta = this.getMeta(state);
      if (finalMeta.winnerId != null) {
        return state;
      }
      if (
        movedByCard &&
        lastLandingPos != null &&
        !lastLandingIsNeutral &&
        !state.pending
      ) {
        return {
          ...state,
          pending: {
            type: 'draw',
            playerId: actorId,
            blocking: true,
            label: 'Piocher une carte (Espace).',
            data: { landedPos: lastLandingPos },
          },
        };
      }
      return state;
    };

    const applyMove = (delta: number, reason: string) => {
      if (!delta) return;

      const ignorePenalty = meta.statuses?.ignoreNextPenalty?.[actorId] === true;
      if (ignorePenalty && delta < 0) {
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
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(next, 'Pénalité ignorée.');
        return;
      }

      const before = meta.positions?.[actorId] ?? 0;
      const after = clamp(before + delta, 0, lastIndex);
      meta = {
        ...meta,
        positions: { ...(meta.positions ?? {}), [actorId]: after },
        lastMoveDelta: { ...(meta.lastMoveDelta ?? {}), [actorId]: delta },
        turnsSinceMoved: { ...(meta.turnsSinceMoved ?? {}), [actorId]: 0 },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

      const casesWord = Math.abs(delta) === 1 ? 'case' : 'cases';
      const verb = delta >= 0 ? 'avance' : 'recule';
      next = this.core.appendLog(
        next,
        this.playerName(next, actorId) +
          ' ' +
          verb +
          ' de ' +
          String(Math.abs(delta)) +
          ' ' +
          casesWord +
          ' (' +
          reason +
          ').',
      );

      logLanding(after);
      movedByCard = true;

      if (after >= lastIndex) {
        meta = { ...meta, winnerId: actorId };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          this.playerName(next, actorId) + ' remporte la partie !',
        );
      }
    };

    const applySkip = (count: number, reason: string) => {
      const ignorePenalty = meta.statuses?.ignoreNextPenalty?.[actorId] === true;
      if (ignorePenalty) {
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
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(next, 'Pénalité ignorée.');
        return;
      }

      const curr = meta.statuses?.skipTurn?.[actorId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses.skipTurn ?? {}),
            [actorId]: curr + Math.max(0, count),
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        this.playerName(next, actorId) + ' devra passer ' + String(count) + ' tour(s) (' + reason + ').',
      );
    };

    // No-op cards
    if (card.kind === 'neutral') {
      return finalize(next);
    }

    // Global cards
    if (card.kind === 'global') {
      next = this.applyGlobal(next, actorId, card);
      meta = this.getMeta(next);
      return finalize(next);
    }

    // Conditional cards
    if (card.kind === 'conditional') {
      next = this.applyConditional(next, actorId, card);
      meta = this.getMeta(next);
      return finalize(next);
    }

    // Rule cards (ids 61..70)
    if (card.kind === 'rule') {
      // Special movement/race rule cards from the main deck (33..37).
      // They behave like a card effect applied after landing on a non-neutral tile.
      if (card.id >= 33 && card.id <= 37) {
        const delta = Number(card.moveDelta ?? 0);
          if (Number.isFinite(delta) && delta !== 0) {
            applyMove(delta, 'carte');
            meta = this.getMeta(next);
            if (meta.winnerId != null) return finalize(next);
          }

        next = this.applySpecialAfterMove(next, actorId, card);
        return finalize(next);
      }
      // 61) roll twice and move total
      if (card.id === 61) {
        const r1 = this.random.rollDice(meta as any, 6);
        meta = { ...meta, ...r1.meta };
        const r2 = this.random.rollDice(meta as any, 6);
        meta = { ...meta, ...r2.meta };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          this.playerName(next, actorId) + ' lance deux dés: ' + String(r1.roll) + ' et ' + String(r2.roll) + '.',
        );
        applyMove(r1.roll + r2.roll, 'règle');
        return finalize(next);
      }

      // 62) extra draw
      if (card.id === 62) {
        return finalize({
          ...next,
          pending: {
            type: 'draw',
            playerId: actorId,
            blocking: true,
            label: 'Piocher une carte supplémentaire (Espace).',
            data: { reason: 'extra_draw' },
          },
        });
      }

      // 63) double next move
      if (card.id === 63) {
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
        return finalize({ ...next, metadata: { ...(next.metadata ?? {}), ...meta } });
      }

      // 64) back 3 then forward 2 => net -1
      if (card.id === 64) {
        applyMove(-1, 'règle');
        return finalize(next);
      }

      // 65) ignore next penalty
      if (card.id === 65) {
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
        return finalize({ ...next, metadata: { ...(next.metadata ?? {}), ...meta } });
      }

      // 66) forward 3 then back 1 => net +2
      if (card.id === 66) {
        applyMove(2, 'règle');
        return finalize(next);
      }

      // 67) choose next player
      if (card.id === 67) {
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
          pendingContext: { kind: 'choose_next_player', actorId } satisfies PendingContext,
        };
        return finalize({
          ...next,
          pending,
          metadata: { ...(next.metadata ?? {}), ...meta },
        });
      }

      // 68) choose next delta
      if (card.id === 68) {
        const pending: PendingState = {
          type: 'choose_next_delta',
          label: 'Choisissez l\'effet pour le prochain joueur dans la liste, puis Entrée.',
          playerId: actorId,
          blocking: true,
          choices: ['Avancer de 1', 'Reculer de 1'],
          data: { deltas: [1, -1] },
        };
        meta = {
          ...meta,
          pendingContext: { kind: 'choose_next_delta', actorId } satisfies PendingContext,
        };
        return finalize({
          ...next,
          pending,
          metadata: { ...(next.metadata ?? {}), ...meta },
        });
      }

      // 69) double next roll
      if (card.id === 69) {
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
        return finalize({ ...next, metadata: { ...(next.metadata ?? {}), ...meta } });
      }

      // 70) mirror next roll from a chosen player
      if (card.id === 70) {
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
            pendingContext: { kind: 'mirror_next_roll', actorId } satisfies PendingContext,
          };
          return {
            ...next,
            pending,
            metadata: { ...(next.metadata ?? {}), ...meta },
          };
        }
      }

      return finalize(next);
    }

    // Skip
    if (card.kind === 'skip') {
      applySkip(1, 'carte');
      return finalize(next);
    }

    // Direct movement
    if (card.kind === 'move') {
      applyMove(Number(card.moveDelta ?? 0), 'carte');
      meta = this.getMeta(next);
      return finalize(next);
    }

    // Swap: move then choose target to swap positions.
    if (card.kind === 'swap') {
      applyMove(Number(card.moveDelta ?? 0), 'carte');
      meta = this.getMeta(next);
      if (meta.winnerId != null) return finalize(next);

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
          pendingContext: { kind: 'swap_after_move', actorId } satisfies PendingContext,
        };
        return finalize({
          ...next,
          pending,
          metadata: { ...(next.metadata ?? {}), ...meta },
        });
      }
      return finalize(next);
    }

    // Special cards in 'rule'/'move' categories that need extra effects after a move.
    next = this.applySpecialAfterMove(next, actorId, card);
    return finalize(next);
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
    const lastIndex = Math.max(0, (meta.tiles?.length ?? 0) - 1);

    const clampPos = (p) => clamp(p, 0, lastIndex);

    const logAll = (message) => {
      next = this.core.appendLog(next, message);
    };

    if (card.id === 41) {
      const vals = ids.map((id) => positions[id] ?? 0);
      const shuffled = this.random.shuffle(meta as any, vals);
      meta = { ...meta, ...shuffled.meta };
      ids.forEach((id, i) => (positions[id] = shuffled.values[i] ?? 0));
      logAll('Chaos : les positions sont m?lang?es.');
    } else if (card.id === 42) {
      // Reverse ranking positions.
      const ranked = [...ids].sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
      const old = ranked.map((id) => positions[id] ?? 0);
      const reversed = [...old].reverse();
      ranked.forEach((id, i) => (positions[id] = reversed[i] ?? (positions[id] ?? 0)));
      logAll('Chaos : ordre du classement invers?.');
    } else if (card.id === 43) {
      // Common lost turn: everyone skips one turn.
      const skip = { ...(meta.statuses?.skipTurn ?? {}) };
      ids.forEach((id) => (skip[id] = (skip[id] ?? 0) + 1));
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      logAll('Tour commun perdu : tout le monde passe son prochain tour.');
    } else if (card.id === 44) {
      ids.forEach((id) => (positions[id] = clampPos((positions[id] ?? 0) + 1)));
      logAll('Tout le monde avance de 1 case.');
    } else if (card.id === 45) {
      ids.forEach((id) => (positions[id] = clampPos((positions[id] ?? 0) - 2)));
      logAll('Tout le monde recule de 2 cases.');
    } else if (card.id === 46) {
      logAll("Rien n'arrive.");
    } else if (card.id === 47) {
      const skip = { ...(meta.statuses?.skipTurn ?? {}) };
      ids.forEach((id) => (skip[id] = (skip[id] ?? 0) + 1));
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      logAll('Tout le monde passe un tour.');
    } else if (card.id === 48) {
      ids.forEach((id) => (positions[id] = clampPos((positions[id] ?? 0) + 1)));
      logAll('Tout le monde avance de 1 case.');
    } else if (card.id === 49) {
      // General shift: each player takes the position of the one just behind (circular).
      const ranked = [...ids].sort((a, b) => (positions[b] ?? 0) - (positions[a] ?? 0));
      const old = ranked.map((id) => positions[id] ?? 0);
      ranked.forEach((id, i) => {
        const fromIdx = (i + 1) % ranked.length;
        positions[id] = old[fromIdx] ?? (positions[id] ?? 0);
      });
      logAll('D?calage g?n?ral des positions.');
    } else if (card.id === 50) {
      // Everyone rolls once and moves.
      for (const id of ids) {
        const rng = this.random.rollDice(meta as any, 6);
        meta = { ...meta, ...rng.meta };
        positions[id] = clampPos((positions[id] ?? 0) + rng.roll);
      }
      logAll('Tout le monde relance le d?.');
    }

    // Persist positions.
    meta = { ...meta, positions };

    // Winner check (highest position reaching the end).
    const reached = ids.filter((id) => (positions[id] ?? 0) >= lastIndex);
    if (reached.length) {
      const winner = reached.sort((a, b) => (positions[b] ?? 0) - (positions[a] ?? 0))[0];
      meta = { ...meta, winnerId: winner };
      next = this.core.appendLog(next, this.playerName(next, winner) + ' remporte la partie !');
    }

    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }


  private applyConditional(
    state: GameStateEntity,
    actorId: number,
    card: CaCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    const lastIndex = Math.max(0, (meta.tiles?.length ?? 0) - 1);
    const pos = meta.positions?.[actorId] ?? 0;

    const ids = Object.keys(meta.positions ?? {}).map(Number).filter(Number.isFinite);
    const positions = { ...(meta.positions ?? {}) };

    const ordered = [...ids].sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
    const leader = ordered[ordered.length - 1];
    const last = ordered[0];

    const applyMove = (delta, note) => {
      if (!delta) return;
      const after = clamp(pos + delta, 0, lastIndex);
      meta = {
        ...meta,
        positions: { ...positions, [actorId]: after },
        lastMoveDelta: { ...(meta.lastMoveDelta ?? {}), [actorId]: delta },
        turnsSinceMoved: { ...(meta.turnsSinceMoved ?? {}), [actorId]: 0 },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(next, this.playerName(next, actorId) + ' ' + (delta >= 0 ? 'avance' : 'recule') + ' de ' + String(Math.abs(delta)) + ' case(s) (' + note + ').');
    };

    if (card.id === 51) {
      applyMove(actorId === leader ? -2 : 2, 'condition');
    } else if (card.id === 52) {
      applyMove(actorId === last ? 3 : 0, 'condition');
    } else if (card.id === 53) {
      const lastDelta = meta.lastMoveDelta?.[actorId] ?? 0;
      applyMove(lastDelta < 0 ? 3 : 0, 'condition');
    } else if (card.id === 54) {
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
        next = this.core.appendLog(next, "Condition : un tour d'attente est annulé.");
      }
    } else if (card.id === 55) {
      const isMultiple = (pos + 1) % 5 === 0;
      applyMove(isMultiple ? 4 : -1, 'condition');
    } else if (card.id === 56) {
      const tsm = meta.turnsSinceMoved?.[actorId] ?? 0;
      applyMove(tsm >= 2 ? 5 : 0, 'condition');
    } else if (card.id === 57) {
      const same = ids.find((id) => id !== actorId && (positions[id] ?? 0) === pos);
      if (same != null) {
        const aAfter = clamp(pos + 2, 0, lastIndex);
        const sAfter = clamp((positions[same] ?? 0) + 2, 0, lastIndex);
        meta = { ...meta, positions: { ...positions, [actorId]: aAfter, [same]: sAfter } };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(next, 'Condition : ' + this.playerName(next, actorId) + ' et ' + this.playerName(next, same) + ' avancent de 2 cases.');
      }
    } else if (card.id === 58) {
      // "Rejouez immédiatement" est ignoré (règle du jeu: la carte termine toujours le tour).
      next = this.core.appendLog(next, "Condition : effet 'rejouer' ignoré.");
    } else if (card.id === 59) {
      // If you are just behind someone by 1, join them.
      const aheadId = ordered[ordered.indexOf(actorId) + 1];
      if (aheadId != null && (positions[aheadId] ?? 0) === pos + 1) {
        meta = { ...meta, positions: { ...positions, [actorId]: positions[aheadId] ?? pos } };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(next, 'Condition : ' + this.playerName(next, actorId) + ' rejoint ' + this.playerName(next, aheadId) + '.');
      }
    } else if (card.id === 60) {
      // Best-effort: if your last movement was exactly +1, you advance +1 again.
      const lastDelta = meta.lastMoveDelta?.[actorId] ?? 0;
      applyMove(lastDelta === 1 ? 1 : 0, 'condition');
    }

    // Winner check.
    meta = this.getMeta(next);
    const endPos = meta.positions?.[actorId] ?? 0;
    if (endPos >= lastIndex) {
      meta = { ...meta, winnerId: actorId };
      next = this.core.appendLog(next, this.playerName(next, actorId) + ' remporte la partie !');
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
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

    const ids = Object.keys(meta.positions ?? {}).map(Number).filter(Number.isFinite);
    const others = ids.filter((id) => id !== actorId);
    const maxPos = others.length ? Math.max(...others.map((id) => meta.positions?.[id] ?? 0)) : myPos;

    // 33) Raccourci secret: take the lead.
    if (card.id === 33) {
      const target = clamp(maxPos + 1, 0, lastIndex);
      meta = { ...meta, positions: { ...(meta.positions ?? {}), [actorId]: target } };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(next, this.playerName(next, actorId) + ' prend la premi?re place.');
      return next;
    }

    // 34) Cactus: ignore next penalty (movement handled by moveDelta).
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

    // 35) Saute-mouton: jump over the next player and push them back.
    if (card.id === 35) {
      const positions = { ...(meta.positions ?? {}) };
      const ahead = others
        .map((id) => ({ id, pos: positions[id] ?? 0 }))
        .filter((x) => x.pos > myPos)
        .sort((a, b) => a.pos - b.pos)[0];

      if (!ahead) {
        next = this.core.appendLog(next, 'Saute-mouton : aucun joueur devant.');
        return next;
      }

      const actorAfter = clamp(ahead.pos + 1, 0, lastIndex);
      const targetAfter = clamp(ahead.pos - 1, 0, lastIndex);
      positions[actorId] = actorAfter;
      positions[ahead.id] = targetAfter;
      meta = { ...meta, positions };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        this.playerName(next, actorId) + ' saute au-dessus de ' + this.playerName(next, ahead.id) + '.',
      );
      return next;
    }

    // 36) Move to next multiple of 5.
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
        this.playerName(next, actorId) + " avance jusqu'à une case multiple de 5.",
      );
      return next;
    }

    return next;
  }


  private advanceTurnWithNextDelta(state: GameStateEntity): GameStateEntity {
    // The game rule is: movement happens on roll, and card draw is mandatory on non-neutral tiles.
    // The optional +/-1 effect for the next player is applied when they roll (not immediately on turn switch).
    return this.turns.advanceTurn(state);
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

function finalize(state: GameStateEntity): GameStateEntity {
  return state;
}
