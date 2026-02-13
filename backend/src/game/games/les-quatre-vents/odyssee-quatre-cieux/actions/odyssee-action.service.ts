import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type { OdysseeMetadata, OdysseePawnState } from '../model/odyssee.types';

type PendingMove = { pawnIndex: number; targetProgress: number; label: string };
const ODYSSEE_DEFAULT_PAWN_NAMES = ['Aube', 'Brise', 'Comete', 'Dune'] as const;

@Injectable()
export class OdysseeActionService {
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
      if (type === 'move_pawn') {
        next = this.handleMovePawn(next, action);
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
    const rng = this.random.rollDice(meta as any, 6);
    meta = { ...meta, ...rng.meta };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
      lastRoll: roll,
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    const moves = this.computeMoves(next, currentId, roll);
    if (moves.length === 0) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} ne peut jouer aucun pion.`,
      );
      return this.endTurn(next, false);
    }

    if (moves.length === 1) {
      next = this.applyMove(next, currentId, moves[0], roll);
      if ((this.getMeta(next) as any).winnerId) return next;
      return this.endTurn(next, roll === 6);
    }

    const label =
      roll === 6
        ? `C'est à ${this.playerName(next, currentId)} de choisir un pion à sortir ou à jouer dans la liste, puis Entrée.`
        : `C'est à ${this.playerName(next, currentId)} de choisir un pion à jouer dans la liste, puis Entrée.`;

    const pending: PendingState = {
      type: 'choose_pawn',
      label,
      playerId: currentId,
      blocking: true,
      choices: moves.map((m) => m.label),
      data: {
        roll,
        moves: moves.map((m) => ({
          pawnIndex: m.pawnIndex,
          targetProgress: m.targetProgress,
        })),
      },
    };

    return { ...next, pending };
  }

  private handleMovePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (
      !pending ||
      pending.type !== 'choose_pawn' ||
      pending.playerId !== currentId
    )
      return state;

    const pawnIndex = Number((action.payload as any)?.pawnIndex);
    const targetProgress = Number((action.payload as any)?.targetProgress);
    if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress))
      return state;

    const roll = Number(pending?.data?.roll);
    const moves: Array<{ pawnIndex: number; targetProgress: number }> =
      Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
    if (
      !moves.some(
        (m) => m.pawnIndex === pawnIndex && m.targetProgress === targetProgress,
      )
    ) {
      return { ...state, pending: null };
    }

    const label =
      pending.choices?.[
        moves.findIndex(
          (m) =>
            m.pawnIndex === pawnIndex && m.targetProgress === targetProgress,
        )
      ] ?? this.choicePawnLabel(state, currentId, pawnIndex);

    let next: GameStateEntity = { ...state, pending: null };
    next = this.applyMove(
      next,
      currentId,
      { pawnIndex, targetProgress, label },
      roll,
    );

    if ((this.getMeta(next) as any).winnerId) return next;
    return this.endTurn(next, roll === 6);
  }

  private computeMoves(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): PendingMove[] {
    const meta = this.getMeta(state);
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    const trackLen = meta.trackLength;
    const homeLen = meta.homeLength;
    const pathLen = trackLen + homeLen;

    const ownTrackPositions = new Set<number>();
    const ownHomeProgresses = new Set<number>();
    const offset = meta.offsets?.[playerId] ?? 0;
    for (const p of pawns) {
      const prog = typeof p.progress === 'number' ? p.progress : -1;
      if (prog >= 0 && prog < trackLen) {
        ownTrackPositions.add((offset + prog) % trackLen);
      } else if (prog >= trackLen && prog < pathLen) {
        ownHomeProgresses.add(prog);
      }
    }

    const moves: PendingMove[] = [];
    for (const pawn of pawns) {
      const prog = typeof pawn.progress === 'number' ? pawn.progress : -1;
      if (prog < 0) {
        if (roll !== 6) continue;
        const pos = offset;
        if (ownTrackPositions.has(pos)) continue;
        moves.push({
          pawnIndex: pawn.pawnIndex,
          targetProgress: 0,
          label: `Sortir ${this.choicePawnLabel(state, playerId, pawn.pawnIndex)}`,
        });
        continue;
      }
      if (prog >= pathLen) continue;
      const target = prog + roll;
      if (target > pathLen) continue;
      if (target < trackLen) {
        const pos = (offset + target) % trackLen;
        if (ownTrackPositions.has(pos)) continue;
      } else if (target >= trackLen && target < pathLen) {
        if (ownHomeProgresses.has(target)) continue;
      }
      moves.push({
        pawnIndex: pawn.pawnIndex,
        targetProgress: target,
        label: `Jouer ${this.choicePawnLabel(state, playerId, pawn.pawnIndex)}`,
      });
    }
    return moves;
  }

  private applyMove(
    state: GameStateEntity,
    playerId: number,
    move: PendingMove,
    _roll: number,
  ): GameStateEntity {
    let meta = this.getMeta(state);
    const trackLen = meta.trackLength;
    const homeLen = meta.homeLength;
    const pathLen = trackLen + homeLen;

    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    const updated = pawns.map((p) =>
      p.pawnIndex === move.pawnIndex
        ? { ...p, progress: move.targetProgress }
        : p,
    );
    meta = {
      ...meta,
      pawnsByPlayer: { ...(meta.pawnsByPlayer ?? {}), [playerId]: updated },
    };

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };

    const pawnLabel = this.pawnLabel(next, playerId, move.pawnIndex);
    const offset = meta.offsets?.[playerId] ?? 0;
    if (move.targetProgress >= 0 && move.targetProgress < trackLen) {
      const pos = (offset + move.targetProgress) % trackLen;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} met ${pawnLabel} en case ${pos + 1}.`,
      );
    } else if (move.targetProgress >= trackLen && move.targetProgress < pathLen) {
      const homeIndex = move.targetProgress - trackLen + 1;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} met ${pawnLabel} dans l'échelle finale (${homeIndex}/${homeLen}).`,
      );
    } else {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} met ${pawnLabel} à l'arrivée.`,
      );
    }

    next = this.applyCapture(
      next,
      playerId,
      move.pawnIndex,
      move.targetProgress,
    );

    meta = this.getMeta(next);
    if (this.isWinner(meta, playerId, pathLen)) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} a gagné !`,
      );
      return {
        ...next,
        status: 'finished',
        metadata: { ...(next.metadata ?? {}), ...meta, winnerId: playerId },
      };
    }

    return next;
  }

  private applyCapture(
    state: GameStateEntity,
    moverId: number,
    moverPawnIndex: number,
    moverProgress: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (moverProgress < 0 || moverProgress >= meta.trackLength) return state;

    const moverOffset = meta.offsets?.[moverId] ?? 0;
    const moverPos = (moverOffset + moverProgress) % meta.trackLength;

    const players = Array.isArray(state.players) ? state.players : [];
    let next = state;

    for (const p of players) {
      if (p.id === moverId) continue;
      const offset = meta.offsets?.[p.id] ?? 0;
      const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
        ? meta.pawnsByPlayer[p.id]
        : [];

      const updated = pawns.map((pawn: any) => {
        const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
        if (prog < 0 || prog >= meta.trackLength) return pawn;
        const pos = (offset + prog) % meta.trackLength;
        if (pos !== moverPos) return pawn;
        next = this.core.appendLog(
          next,
        `${this.playerName(next, moverId)} capture ${this.playerName(next, p.id)} (${this.pawnLabel(next, p.id, pawn.pawnIndex)}) : retour à la base.`,
        );
        return { ...pawn, progress: -1 };
      });

      next = {
        ...next,
        metadata: {
          ...(next.metadata ?? {}),
          ...meta,
          pawnsByPlayer: { ...(meta.pawnsByPlayer ?? {}), [p.id]: updated },
        },
      };
    }

    return next;
  }

  private isWinner(
    meta: OdysseeMetadata,
    playerId: number,
    pathLen: number,
  ): boolean {
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    return (
      pawns.length === 4 &&
      pawns.every(
        (p) => typeof p.progress === 'number' && p.progress >= pathLen,
      )
    );
  }

  private endTurn(state: GameStateEntity, extraTurn: boolean): GameStateEntity {
    if (extraTurn) {
      const currentId = state.turn?.currentPlayerId ?? null;
      const who =
        currentId != null ? this.playerName(state, currentId) : 'Le joueur';
      return this.core.appendLog(state, `6 : ${who} rejoue.`);
    }
    return this.turns.advanceTurn(state);
  }

  private getMeta(state: GameStateEntity): OdysseeMetadata {
    return (state.metadata ?? {}) as any as OdysseeMetadata;
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

  private pawnLabel(
    state: GameStateEntity,
    playerId: number,
    pawnIndex: number,
  ): string {
    return `"${this.resolvePawnName(state, playerId, pawnIndex)}"`;
  }

  private choicePawnLabel(
    state: GameStateEntity,
    playerId: number,
    pawnIndex: number,
  ): string {
    return `"${this.resolvePawnName(state, playerId, pawnIndex)}"`;
  }

  private resolvePawnName(
    state: GameStateEntity,
    playerId: number,
    pawnIndex: number,
  ): string {
    const meta = this.getMeta(state) as any;
    const names = Array.isArray(meta?.pawnNamesByPlayer?.[playerId])
      ? meta.pawnNamesByPlayer[playerId]
      : [];
    const byIndex =
      typeof names[pawnIndex] === 'string' ? String(names[pawnIndex]).trim() : '';
    if (byIndex) return byIndex;

    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x: any) => x?.id === playerId) as any;
    const singlePawn =
      typeof p?.pawn === 'string' ? String(p.pawn).trim() : '';
    if (singlePawn) return singlePawn;

    const base =
      ODYSSEE_DEFAULT_PAWN_NAMES[
        Math.abs(Math.trunc(pawnIndex)) % ODYSSEE_DEFAULT_PAWN_NAMES.length
      ];
    return `${base} (${this.playerName(state, playerId)})`;
  }
}
