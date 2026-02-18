import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { PromptPoliciesService } from '../../../../modules/prompt-policies/services/prompt-policies.service';
import type { JeuOieMetadata, JeuOieTile } from '../model/jeu-oie-state.entity';

import { applyActionsSequentially, dispatchByActionType, normalizeActionType } from '../../../../actions/action-service.helper';
@Injectable()
export class JeuOieActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setupFlow: SetupFlowService,
    private readonly turnPolicies?: TurnPoliciesService,
    private readonly promptPolicies?: PromptPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(
      this.ensurePawnSelectionPrompt(state),
      actions,
      (current, action) => {
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            choose_pawn: () =>
              this.ensurePawnSelectionPrompt(
                this.handleChoosePawn(current, action),
              ),
            roll: () => this.handleRoll(current),
            ROLL_DICE: () => this.handleRoll(current),
            roll_dice: () => this.handleRoll(current),
          },
          () => current,
        );
      },
    );
    return this.ensurePawnSelectionPrompt(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = (action?.payload ?? {}) as any;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const chosen = this.resolvePendingPawn(rawPawn, options);
    if (!chosen) return state;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: JeuOieMetadata = {
      ...meta,
      pawns:
        Array.isArray(meta.pawns) && meta.pawns.length > 0
          ? meta.pawns
          : options.map((p: any) => ({
              id: String(p?.id ?? '').trim(),
              label: String(p?.label ?? '').trim(),
              feminine: Boolean(p?.feminine),
            })),
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion : ${String(chosen.label ?? 'pion').trim()}.`,
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
    const starterName = this.playerName(started, resolvedStarterId ?? 0);
    started = this.core.appendLog(
      started,
      `Début de partie : ${starterName} commence.`,
    );
    return this.getTurnPolicies().appendTurnAnnouncement(
      started,
      resolvedStarterId,
      (s, id) => this.playerName(s, id),
    );
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    const inWell = Boolean(meta.statuses?.well?.[currentId]);
    const rng = this.random.rollDice(meta as any, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(state, currentId)} lance le dé : "${roll}".`,
    );

    if (inWell) {
      if (roll !== 1) {
        const logged = this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} reste bloqué dans le puits.`,
        );
        return this.turns.advanceTurn(logged, {
          playerNameResolver: (s, id) => this.playerName(s, id),
        });
      }
      const metaAfter = this.getMeta(next);
      const well = { ...(metaAfter.statuses?.well ?? {}) };
      delete well[currentId];
      next = {
        ...next,
        metadata: {
          ...(next.metadata ?? {}),
          ...metaAfter,
          statuses: { ...(metaAfter.statuses ?? {}), well },
        },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} sort du puits.`,
      );
    }

    const currentPos = meta.positions?.[currentId] ?? 1;
    const moved = this.move(currentPos, roll);
    next = this.applyLanding(next, currentId, moved, roll);

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      return { ...next, status: 'finished' };
    }

    return this.turns.advanceTurn(next, {
      playerNameResolver: (s, id) => this.playerName(s, id),
    });
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
    roll: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: JeuOieTile | undefined = tiles[position];

    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: position },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const label = tile?.label ?? `Case ${position}`;
    const compactLabel = this.compactTileLabel(label, position);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} place ${this.pawnPossessiveLabel(next, playerId)} en case ${position} (${compactLabel}).`,
    );

    if (!tile) return next;

    if (tile.description && String(tile.description).trim()) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} a gagné !`,
      );
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'bridge') {
      const jumpTo = 12;
      next = this.core.appendLog(
        next,
        `Pont : avance directement à la case ${jumpTo}.`,
      );
      return this.applyLanding(next, playerId, jumpTo, roll);
    }

    if (tile.type === 'death') {
      next = this.core.appendLog(next, 'Mort : retour au départ.');
      return this.applyLanding(next, playerId, tile.backTo, roll);
    }

    if (tile.type === 'labyrinth') {
      next = this.core.appendLog(
        next,
        `Labyrinthe : retour à la case ${tile.backTo}.`,
      );
      return this.applyLanding(next, playerId, tile.backTo, roll);
    }

    if (tile.type === 'inn' || tile.type === 'prison') {
      const turns = tile.skipTurns ?? 1;
      const suffix =
        turns === 1
          ? ''
          : ` (passera ses ${turns} prochains tours).`;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} perd ${turns} tour(s).${suffix}`,
      );
      meta = this.getMeta(next);
      const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
      const statuses = meta.statuses ?? { skipTurn: {} };
      const skipTurn = {
        ...(statuses.skipTurn ?? {}),
        [playerId]: currentSkip + turns,
      };
      meta = { ...meta, statuses: { ...statuses, skipTurn } };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'magic_die') {
      const rng = this.random.rollDice(this.getMeta(next) as any, 6);
      const magicRoll = rng.roll;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...rng.meta },
        lastRoll: magicRoll,
      };
      next = this.core.appendLog(
        next,
        `Dé magique : ${this.playerName(next, playerId)} lance "${magicRoll}".`,
      );
      const delta = magicRoll <= 3 ? magicRoll : -magicRoll;
      const moved = this.move(position, delta);
      next = this.core.appendLog(
        next,
        magicRoll <= 3
          ? `Dé magique : avance de ${magicRoll} case(s).`
          : `Dé magique : recule de ${magicRoll} case(s).`,
      );
      return this.applyLanding(next, playerId, moved, magicRoll);
    }

    if (tile.type === 'well') {
      const metaNow = this.getMeta(next);
      const well = { ...(metaNow.statuses?.well ?? {}) };
      well[playerId] = true;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} est bloqué dans le puits (il faut faire 1 pour sortir).`,
      );
      return {
        ...next,
        metadata: {
          ...(next.metadata ?? {}),
          ...metaNow,
          statuses: { ...(metaNow.statuses ?? {}), well },
        },
      };
    }

    if (tile.type === 'goose') {
      next = this.core.appendLog(
        next,
        `Oie : avance à nouveau de ${roll} case(s).`,
      );
      const moved = this.move(position, roll);
      return this.applyLanding(next, playerId, moved, roll);
    }

    return next;
  }

  private move(currentPos: number, roll: number): number {
    const target = currentPos + roll;
    if (target < 0) return 0;
    if (target === 63) return 63;
    if (target < 63) return target;
    const overshoot = target - 63;
    return 63 - overshoot;
  }

  private getMeta(state: GameStateEntity): JeuOieMetadata {
    return (state.metadata ?? {}) as any as JeuOieMetadata;
  }

  private buildPawnPending(
    state: GameStateEntity,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const allPawns = Array.isArray(meta.pawns) ? meta.pawns : [];
    const used = new Set(Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'));
    const choices = allPawns
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
        feminine: Boolean(p?.feminine),
      }))
      .filter((p) => p.id.length > 0 && !used.has(p.id));

    return this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: startId,
      isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
      pendingType: 'choose_pawn',
      choices,
      labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir son pion.`,
      dataBuilder: (availableChoices) => ({
        pawns: availableChoices.map((p: any) => ({
          id: String(p?.id ?? '').trim(),
          label: String(p?.label ?? '').trim(),
          feminine: Boolean(p?.feminine),
        })),
      }),
    });
  }

  private resolvePendingPawn(
    raw: unknown,
    options: Array<{ id?: string; label?: string; feminine?: boolean }>,
  ): { id: string; label: string; feminine: boolean } | null {
    const normalized = (Array.isArray(options) ? options : [])
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
        feminine: Boolean(p?.feminine),
      }))
      .filter((p) => p.id.length > 0 && p.label.length > 0);
    if (!normalized.length) return null;
    return this.setupFlow.resolveChoice(
      typeof raw === 'object'
        ? (raw as any)?.id ?? (raw as any)?.pawnId ?? (raw as any)?.value ?? raw
        : raw,
      normalized,
    ) as { id: string; label: string; feminine: boolean } | null;
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

  private pawnLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p: any) => String(p?.id ?? '').trim() === pawnId)
      : null;
    const label = String((pawn as any)?.label ?? '').trim();
    if (label) return label;
    return 'pion';
  }

  private pawnPossessiveLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p: any) => String(p?.id ?? '').trim() === pawnId)
      : null;
    const label = this.pawnLabel(state, id);
    const feminine = Boolean((pawn as any)?.feminine);
    const possessive = feminine ? 'sa' : 'son';
    return `"${possessive} ${this.lowercaseFirst(label)}"`;
  }

  private lowercaseFirst(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) return text;
    if (text.length === 1) return text.toLowerCase();
    return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  private compactTileLabel(label: string, position: number): string {
    const raw = String(label ?? '').trim();
    const withPrefix = new RegExp(`^case\\s+${position}\\s*-\\s*`, 'i');
    const stripped = raw.replace(withPrefix, '').trim();
    return stripped || raw || `Case ${position}`;
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    return state;
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }

  private getPromptPolicies(): PromptPoliciesService {
    return this.promptPolicies ?? new PromptPoliciesService(this.core);
  }
}

