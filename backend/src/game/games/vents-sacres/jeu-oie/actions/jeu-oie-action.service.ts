import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import type { JeuOieMetadata, JeuOieTile } from '../model/jeu-oie-state.entity';

@Injectable()
export class JeuOieActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.ensurePawnSelectionPrompt(state);
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'choose_pawn') {
        next = this.handleChoosePawn(next, action);
        next = this.ensurePawnSelectionPrompt(next);
        continue;
      }
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
      }
    }
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
      `Debut de partie : ${starterName} commence.`,
    );
    return this.appendTurnAnnouncement(started, resolvedStarterId);
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
      `${this.playerName(state, currentId)} lance le de : "${roll}".`,
    );

    if (inWell) {
      if (roll !== 1) {
        const logged = this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} reste bloque dans le puits.`,
        );
        return this.advanceTurnWithAnnouncement(logged);
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

    return this.advanceTurnWithAnnouncement(next);
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
      `${this.playerName(next, playerId)} met ${this.pawnPossessiveLabel(next, playerId)} en case ${position} (${compactLabel}).`,
    );

    if (!tile) return next;

    if (tile.description && String(tile.description).trim()) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} a gagne !`,
      );
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'bridge') {
      const jumpTo = 12;
      next = this.core.appendLog(
        next,
        `Pont : avance directement a la case ${jumpTo}.`,
      );
      return this.applyLanding(next, playerId, jumpTo, roll);
    }

    if (tile.type === 'death') {
      next = this.core.appendLog(next, 'Mort : retour au depart.');
      return this.applyLanding(next, playerId, tile.backTo, roll);
    }

    if (tile.type === 'labyrinth') {
      next = this.core.appendLog(
        next,
        `Labyrinthe : retour a la case ${tile.backTo}.`,
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
        `De magique : ${this.playerName(next, playerId)} lance "${magicRoll}".`,
      );
      const delta = magicRoll <= 3 ? magicRoll : -magicRoll;
      const moved = this.move(position, delta);
      next = this.core.appendLog(
        next,
        magicRoll <= 3
          ? `De magique : avance de ${magicRoll} case(s).`
          : `De magique : recule de ${magicRoll} case(s).`,
      );
      return this.applyLanding(next, playerId, moved, magicRoll);
    }

    if (tile.type === 'well') {
      const metaNow = this.getMeta(next);
      const well = { ...(metaNow.statuses?.well ?? {}) };
      well[playerId] = true;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} est bloque dans le puits (il faut faire 1 pour sortir).`,
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
        `Oie : avance a nouveau de ${roll} case(s).`,
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
    if (!players.length) return null;

    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const startIndex =
      startId != null ? players.findIndex((p) => p?.id === startId) : -1;
    const baseIndex = startIndex >= 0 ? startIndex : 0;
    let nextIndex = -1;
    for (let i = 0; i < players.length; i += 1) {
      const idx = (baseIndex + i) % players.length;
      const pid = players[idx]?.id;
      if (pid == null) continue;
      if (!pawnByPlayerId[pid]) {
        nextIndex = idx;
        break;
      }
    }
    if (nextIndex < 0) return null;

    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    const allPawns = Array.isArray(meta.pawns) ? meta.pawns : [];
    const choices = allPawns.filter((p: any) => !used.has(String(p?.id ?? '')));
    if (!choices.length) return null;

    const chooserId = players[nextIndex].id;
    const chooserLabel = this.playerName(state, chooserId);
    return {
      playerId: chooserId,
      turnIndex: nextIndex,
      pending: {
        type: 'choose_pawn',
        playerId: chooserId,
        blocking: true,
        label: `C'est à ${chooserLabel} de choisir son pion.`,
        choices: choices.map((p: any) => String(p?.label ?? '').trim()),
        data: {
          pawns: choices.map((p: any) => ({
            id: String(p?.id ?? '').trim(),
            label: String(p?.label ?? '').trim(),
            feminine: Boolean(p?.feminine),
          })),
        },
      },
    };
  }

  private resolvePendingPawn(
    raw: unknown,
    options: Array<{ id?: string; label?: string; feminine?: boolean }>,
  ): { id: string; label: string; feminine: boolean } | null {
    if (!Array.isArray(options) || options.length === 0) return null;
    const normalized = options
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
        feminine: Boolean(p?.feminine),
      }))
      .filter((p) => p.id.length > 0 && p.label.length > 0);
    if (!normalized.length) return null;

    const value =
      typeof raw === 'object'
        ? (raw as any)?.id ?? (raw as any)?.pawnId ?? (raw as any)?.value ?? raw
        : raw;
    const key = this.normalizePawnKey(value);
    if (!key) return null;

    const byId = normalized.find((p) => this.normalizePawnKey(p.id) === key);
    if (byId) return byId;
    const byLabel = normalized.find(
      (p) => this.normalizePawnKey(p.label) === key,
    );
    return byLabel ?? null;
  }

  private normalizePawnKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
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

  private appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) return state;
    return this.core.appendLog(
      state,
      `C'est au tour de ${this.playerName(state, playerId)}.`,
    );
  }

  private advanceTurnWithAnnouncement(state: GameStateEntity): GameStateEntity {
    const next = this.turns.advanceTurn(state);
    return this.appendTurnAnnouncement(next, next.turn?.currentPlayerId ?? null);
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;
    const chooserId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (chooserId == null) return state;
    return this.appendLogOnce(
      state,
      `${this.playerName(state, chooserId)} doit choisir un pion.`,
    );
  }

  private appendLogOnce(state: GameStateEntity, message: string): GameStateEntity {
    const log = Array.isArray(state.log) ? state.log : [];
    const last = String(log[log.length - 1]?.message ?? '').trim();
    if (last === message) return state;
    return this.core.appendLog(state, message);
  }
}
