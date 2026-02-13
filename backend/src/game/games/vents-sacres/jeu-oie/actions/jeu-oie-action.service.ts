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
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
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
        return this.turns.advanceTurn(logged);
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

    return this.turns.advanceTurn(next);
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
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} met ${this.pawnLabel(next, playerId)} en case ${position} (${label}).`,
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
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x: any) => x?.id === id) as any;
    const pawn = typeof p?.pawn === 'string' ? String(p.pawn).trim() : '';
    const resolved = pawn || this.playerName(state, id);
    return `"${resolved}"`;
  }
}
