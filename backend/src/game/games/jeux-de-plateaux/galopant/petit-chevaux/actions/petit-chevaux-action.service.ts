import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import type {
  PetitChevauxMetadata,
  PetitChevauxPawnState,
} from '../model/petit-chevaux-state.entity';
import { PetitChevauxSetupService } from '../setup/petit-chevaux-setup.service';

type PendingMove = {
  pawnIndex: number;
  targetProgress: number;
  label: string;
};

@Injectable()
export class PetitChevauxActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setup: PetitChevauxSetupService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'ROLL_DICE' || type === 'roll_dice' || type === 'roll') {
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
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
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

    const moves = this.computeMoves(next, currentId, roll);
    if (moves.length === 0) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state, currentId)} ne peut jouer aucun pion.`,
      );
      return this.endTurn(next, false);
    }

    if (moves.length === 1) {
      next = this.applyMove(next, currentId, moves[0], roll);
      next = this.setup.recomputeBoardView(next);
      if ((next.metadata as any)?.winnerId) {
        return next;
      }
      return this.endTurn(next, roll === 6);
    }

    const hasStableExit =
      roll === 6 && moves.some((m) => typeof m?.targetProgress === 'number' && m.targetProgress === 0);
    const label = hasStableExit && moves.every((m) => m.targetProgress === 0)
      ? 'Choisissez un cheval à sortir dans la liste, puis Entrée.'
      : hasStableExit
        ? 'Choisissez un cheval à sortir ou à jouer dans la liste, puis Entrée.'
        : 'Choisissez un cheval à jouer dans la liste, puis Entrée.';

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
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn' || pending.playerId !== currentId) {
      return state;
    }

    const payload = (action?.payload ?? {}) as any;
    const pawnIndex =
      typeof payload.pawnIndex === 'number'
        ? payload.pawnIndex
        : Number(payload.pawnIndex);
    const targetProgress =
      typeof payload.targetProgress === 'number'
        ? payload.targetProgress
        : Number(payload.targetProgress);
    if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress)) {
      return state;
    }

    const roll = Number(pending?.data?.roll);
    const pendingMoves: Array<{ pawnIndex: number; targetProgress: number }> =
      Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
    const matched = pendingMoves.find(
      (m) => m?.pawnIndex === pawnIndex && m?.targetProgress === targetProgress,
    );
    if (!matched) {
      return state;
    }

    let next: GameStateEntity = { ...state, pending: null };
    next = this.applyMove(next, currentId, { pawnIndex, targetProgress }, roll);
    next = this.setup.recomputeBoardView(next);
    if ((next.metadata as any)?.winnerId) {
      return next;
    }
    return this.endTurn(next, roll === 6);
  }

  private computeMoves(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): PendingMove[] {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    const offset = meta.offsets?.[playerId] ?? 0;
    const pathLen = meta.trackLength + meta.homeLength;

    const occupiedBySelf = new Set<number>();
    for (const pawn of pawns) {
      const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
      if (prog >= 0 && prog < meta.trackLength) {
        occupiedBySelf.add((offset + prog) % meta.trackLength);
      }
    }

    const moves: PendingMove[] = [];
    for (const pawn of pawns) {
      const pawnIndex = pawn?.pawnIndex;
      const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
      if (typeof pawnIndex !== 'number') continue;
      if (prog >= pathLen) continue;

      let targetProgress: number | null = null;

      if (prog < 0) {
        if (roll === 6) targetProgress = 0;
      } else {
        const nextProg = prog + roll;
        if (nextProg <= pathLen) {
          targetProgress = nextProg;
        }
      }

      if (targetProgress == null) continue;

      if (targetProgress >= 0 && targetProgress < meta.trackLength) {
        const destPos = (offset + targetProgress) % meta.trackLength;
        if (occupiedBySelf.has(destPos)) {
          continue; // blocage : 2 pions du même joueur sur la même case
        }
      }

      const from = this.describeProgress(meta, playerId, prog);
      const to = this.describeProgress(meta, playerId, targetProgress);
      moves.push({
        pawnIndex,
        targetProgress,
        label: `Cheval ${pawnIndex + 1} (${from}) : aller à ${to}`,
      });
    }

    return moves;
  }

  private applyMove(
    state: GameStateEntity,
    playerId: number,
    move: { pawnIndex: number; targetProgress: number },
    roll: number,
  ): GameStateEntity {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];

    const pawn = pawns.find((p: any) => p?.pawnIndex === move.pawnIndex) as
      | PetitChevauxPawnState
      | undefined;
    if (!pawn) return state;

    const prevProg = typeof pawn.progress === 'number' ? pawn.progress : -1;
    const nextProg = move.targetProgress;

    const updatedPawns = pawns.map((p: any) =>
      p?.pawnIndex === move.pawnIndex ? { ...p, progress: nextProg } : p,
    );
    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        pawnsByPlayer: {
          ...(meta.pawnsByPlayer ?? {}),
          [playerId]: updatedPawns,
        },
      },
    };

    const rollInt = Number.isFinite(roll) ? Math.trunc(roll) : 0;
    if (prevProg < 0 && nextProg === 0) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} sort le cheval ${move.pawnIndex + 1}.`,
      );
    } else {
      const casesWord = rollInt == 1 ? 'case' : 'cases';
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} avance de ${rollInt} ${casesWord}.`,
      );
    }

    // Messages clairs pour l'entrée dans la maison / arrivée (sans coordonnées "case x/52").
    if (prevProg >= 0 && prevProg < meta.trackLength && nextProg >= meta.trackLength) {
      const homeIndex = nextProg - meta.trackLength + 1;
      if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
        next = this.core.appendLog(
          next,
          `${this.playerName(state, playerId)} entre dans la maison (${homeIndex}/${meta.homeLength}).`,
        );
      }
    }
    const pathLen = meta.trackLength + meta.homeLength;
    if (prevProg < pathLen && nextProg >= pathLen) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} met le cheval ${move.pawnIndex + 1} à l'arrivée.`,
      );
    }

    next = this.applyCapture(next, playerId, move.pawnIndex, nextProg);

    if (this.isWinner(next, playerId, pathLen)) {
      next = this.core.appendLog(next, `${this.playerName(state, playerId)} a gagné !`);
      return {
        ...next,
        status: 'finished',
        metadata: { ...(next.metadata ?? {}), winnerId: playerId },
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
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    if (!(typeof moverProgress === 'number')) return state;
    if (moverProgress < 0 || moverProgress >= meta.trackLength) return state;

    const moverOffset = meta.offsets?.[moverId] ?? 0;
    const moverPos = (moverOffset + moverProgress) % meta.trackLength;
    const isSafe = Array.isArray(meta.safeTiles) && meta.safeTiles.includes(moverPos);
    if (isSafe) return state;

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
          `${this.playerName(state, moverId)} capture ${this.playerName(state, p.id)} (cheval ${pawn.pawnIndex + 1}) : retour à l'écurie.`,
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

  private endTurn(state: GameStateEntity, extraTurn: boolean): GameStateEntity {
    if (extraTurn) {
      const currentId = state.turn?.currentPlayerId ?? null;
      const who = currentId != null ? this.playerName(state, currentId) : 'Le joueur';
      return this.core.appendLog(state, `6 : ${who} rejoue.`);
    }
    return this.turns.advanceTurn(state);
  }

  private isWinner(state: GameStateEntity, playerId: number, pathLen: number): boolean {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    if (pawns.length !== 4) return false;
    return pawns.every((p: any) => typeof p?.progress === 'number' && p.progress >= pathLen);
  }

  private describeProgress(meta: PetitChevauxMetadata, playerId: number, progress: number): string {
    if (!Number.isFinite(progress) || progress < 0) {
      return "écurie";
    }
    const pathLen = meta.trackLength + meta.homeLength;
    if (progress >= pathLen) {
      return 'arrivée';
    }
    if (progress < meta.trackLength) {
      const offset = meta.offsets?.[playerId] ?? 0;
      const pos = (offset + progress) % meta.trackLength;
      return `case ${pos + 1}/${meta.trackLength}`;
    }
    const homeIndex = progress - meta.trackLength + 1;
    return `maison ${homeIndex}/${meta.homeLength}`;
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x) => x?.id === id);
    const u = p?.username && String(p.username).trim() ? String(p.username).trim() : null;
    return u ?? `Joueur ${id}`;
  }
}
