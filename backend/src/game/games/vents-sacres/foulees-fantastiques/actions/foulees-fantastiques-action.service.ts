import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import type {
  PetitChevauxMetadata,
  PetitChevauxPawnState,
} from '../model/petit-chevaux-state.entity';
import { FouleesFantastiquesSetupService } from '../setup/foulees-fantastiques-setup.service';

type PendingMove = {
  pawnIndex: number;
  targetProgress: number;
  label: string;
};

@Injectable()
export class FouleesFantastiquesActionService {
  private readonly families = [
    {
      id: 'equides',
      family: 'Equidés',
      habitat: 'écurie',
      pawns: ['Alkhal-téké', 'Andalou', 'Frison', 'Pur-sang'],
    },
    {
      id: 'primates',
      family: 'Primates',
      habitat: 'primaterie',
      pawns: ['Douc', 'Gibbon', 'Mandrill', 'Sakis'],
    },
    {
      id: 'oiseaux',
      family: 'Oiseaux',
      habitat: 'volière',
      pawns: ['Cygne', 'Héron', 'Paon', 'Perroquet'],
    },
    {
      id: 'poissons',
      family: 'Poissons',
      habitat: 'aquarium',
      pawns: ['Anthias', 'Discus', 'Mandarin', 'Mérou'],
    },
  ] as const;

  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setup: FouleesFantastiquesSetupService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'choose_family') {
        next = this.handleChooseFamily(next, action);
        continue;
      }
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

  private ensureFamilyPending(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const familyByPlayer = (meta.familyByPlayer ?? {}) as Record<number, string>;

    const allChosen = players.every((p) => {
      const f = familyByPlayer[p.id];
      return typeof f === 'string' && f.trim().length > 0;
    });
    if (allChosen) {
      let next: GameStateEntity = { ...state, phase: 'turn', pending: null };
      const habitatByPlayer = (meta.habitatByPlayer ?? {}) as Record<
        number,
        string
      >;
      const pawnNamesByPlayer = (meta.pawnNamesByPlayer ??
        {}) as Record<number, string[]>;
      for (const p of players) {
        const color = meta.colorsByPlayer?.[p.id];
        const family = familyByPlayer[p.id];
        const habitat = habitatByPlayer[p.id];
        const pawns = pawnNamesByPlayer[p.id];
        if (!family || !habitat || !Array.isArray(pawns) || pawns.length !== 4) {
          continue;
        }
        next = this.core.appendLog(
          next,
          `${p.username} reçoit les pions ${color}. Famille des ${family} (${habitat}) : ${pawns.join(', ')}.`,
        );
      }
      return this.core.appendLog(next, 'Début de partie.');
    }

    const currentId = state.turn?.currentPlayerId ?? players[0]?.id ?? null;
    if (currentId == null) return state;

    // Si le joueur courant a déjà choisi, passer au suivant.
    const already = familyByPlayer[currentId];
    if (typeof already === 'string' && already.trim().length > 0) {
      const advanced = this.turns.advanceTurn({ ...state, pending: null });
      return this.ensureFamilyPending(advanced);
    }

    const pending: PendingState = {
      type: 'choose_family',
      playerId: currentId,
      blocking: true,
      label: "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entrée.",
      choices: this.families.map((f) => `Famille des ${f.family} (${f.habitat})`),
      data: { familyIds: this.families.map((f) => f.id) },
    };
    return { ...state, pending };
  }

  private handleChooseFamily(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const pending: any = state.pending ?? null;
    if (!pending || pending.type !== 'choose_family' || pending.playerId !== currentId) {
      return state;
    }

    const familyId = String((action.payload as any)?.familyId ?? '')
      .trim()
      .toLowerCase();
    const pack = this.families.find((f) => f.id === familyId);
    if (!pack) {
      return this.core.appendLog({ ...state, pending: null }, 'Famille invalide.');
    }

    const nextMeta: PetitChevauxMetadata = {
      ...meta,
      familyByPlayer: {
        ...(meta.familyByPlayer ?? {}),
        [currentId]: pack.family,
      },
      habitatByPlayer: {
        ...(meta.habitatByPlayer ?? {}),
        [currentId]: pack.habitat,
      },
      pawnNamesByPlayer: {
        ...(meta.pawnNamesByPlayer ?? {}),
        [currentId]: [...pack.pawns],
      },
    };
    let next: GameStateEntity = { ...state, metadata: nextMeta, pending: null };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} choisit la famille des ${pack.family} (${pack.habitat}).`,
    );
    next = this.turns.advanceTurn(next);
    return this.ensureFamilyPending(next);
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    // Tant que les familles ne sont pas choisies, on force l'étape de setup.
    if (String(state.phase ?? '').toLowerCase().trim() !== 'turn') {
      return this.ensureFamilyPending(state);
    }

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
      `${this.playerName(state, currentId)} lance le dé : ${roll}.`,
    );

    const moves = this.computeMoves(next, currentId, roll);
    if (moves.length === 0) {
      const blockInfo = this.findBlockingOpponent(next, currentId, roll);
      next = this.core.appendLog(
        next,
        blockInfo ??
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
      roll === 6 &&
      moves.some(
        (m) => typeof m?.targetProgress === 'number' && m.targetProgress === 0,
      );
    const label =
      hasStableExit && moves.every((m) => m.targetProgress === 0)
        ? 'Choisissez un animal à sortir dans la liste, puis Entrée.'
        : hasStableExit
          ? 'Choisissez un animal à sortir ou à jouer dans la liste, puis Entrée.'
          : 'Choisissez un animal à jouer dans la liste, puis Entrée.';

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
    if (
      !pending ||
      pending.type !== 'choose_pawn' ||
      pending.playerId !== currentId
    ) {
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
    const arrivalProgress = meta.trackLength + meta.homeLength - 1;

    const opponentsOnTrack = this.buildOpponentTrackIndex(state, playerId);

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
      if (prog >= arrivalProgress) continue;

      let targetProgress: number | null = null;

      if (prog < 0) {
        if (roll === 6) targetProgress = 0;
      } else if (prog >= meta.trackLength) {
        // Abri (maison) : progression spéciale.
        // Règle: pour avancer d'une case dans l'abri, il faut faire le numéro de la prochaine case.
        // Ex: abri 1 -> abri 2 : faire 2, abri 2 -> abri 3 : faire 3, etc.
        const homeIndex = prog - meta.trackLength + 1; // 1..homeLength
        if (homeIndex >= 1 && homeIndex < meta.homeLength) {
          const required = homeIndex + 1; // 2..homeLength
          if (roll === required) {
            targetProgress = prog + 1;
          }
        }
      } else {
        const nextProg = prog + roll;
        if (nextProg <= arrivalProgress) {
          // Règle : l'entrée dans la maison doit être "pile".
          // On ne peut pas dépasser l'entrée de maison dans le même lancer : il faut arriver exactement à trackLength.
          if (prog < meta.trackLength && nextProg > meta.trackLength) {
            targetProgress = nextProg === meta.trackLength ? nextProg : null;
          } else {
            targetProgress = nextProg;
          }
        }
      }

      if (targetProgress == null) continue;

      // Nouvelle règle : un pion adverse sur le chemin bloque.
      // Pour avancer, il faut tomber exactement dessus (capture), donc "pile-poil" la distance manquante.
      if (prog >= 0) {
        const blocked = this.isBlockedByOpponentOnPath(
          meta,
          offset,
          prog,
          targetProgress,
          roll,
          opponentsOnTrack,
        );
        if (blocked) {
          continue;
        }
      }

      if (targetProgress >= 0 && targetProgress < meta.trackLength) {
        const destPos = (offset + targetProgress) % meta.trackLength;
        if (occupiedBySelf.has(destPos)) {
          continue; // blocage : 2 pions du même joueur sur la même case
        }

        // Interdit de finir sur une case safe occupée par un adversaire (on ne peut pas capturer en safe).
        if (opponentsOnTrack.has(destPos)) {
          const isSafe =
            Array.isArray(meta.safeTiles) && meta.safeTiles.includes(destPos);
          if (isSafe) {
            continue;
          }
        }
      }

      const from = this.describeProgress(meta, playerId, prog);
      const to = this.describeProgress(meta, playerId, targetProgress);
      const pawnLabel = this.pawnLabel(state, playerId, pawnIndex);
      moves.push({
        pawnIndex,
        targetProgress,
        label: `${pawnLabel} (${from}) : aller à ${to}`,
      });
    }

    return moves;
  }

  private buildOpponentTrackIndex(
    state: GameStateEntity,
    viewerPlayerId: number,
  ): Set<number> {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const occupied = new Set<number>();

    for (const p of players) {
      if (!p || p.id === viewerPlayerId) continue;
      const offset = meta.offsets?.[p.id] ?? 0;
      const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
        ? meta.pawnsByPlayer[p.id]
        : [];
      for (const pawn of pawns) {
        const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
        if (prog < 0 || prog >= meta.trackLength) continue;
        occupied.add((offset + prog) % meta.trackLength);
      }
    }

    return occupied;
  }

  private isBlockedByOpponentOnPath(
    meta: PetitChevauxMetadata,
    myOffset: number,
    fromProgress: number,
    toProgress: number,
    roll: number,
    opponentsOnTrack: Set<number>,
  ): boolean {
    if (!Number.isFinite(roll) || roll <= 1) return false;
    if (fromProgress < 0) return false;

    const steps = Math.max(0, Math.trunc(roll));
    for (let step = 1; step <= steps; step++) {
      const intermediateProgress = fromProgress + step;
      if (intermediateProgress < 0) continue;
      if (intermediateProgress >= meta.trackLength) {
        // Dès qu'on quitte la piste, il n'y a plus d'adversaires à "dépasser" (maison/arrivée).
        break;
      }

      const pos = (myOffset + intermediateProgress) % meta.trackLength;
      if (!opponentsOnTrack.has(pos)) {
        continue;
      }

      // On a un pion adverse sur le chemin.
      // Autorisé seulement si on tombe exactement dessus (capture => étape finale).
      if (intermediateProgress !== toProgress) {
        return true;
      }
    }

    return false;
  }

  private findBlockingOpponent(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): string | null {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    if (!meta || meta.trackLength == null) return null;
    if (!Number.isFinite(roll) || roll <= 1) return null;

    const myPawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    const myOffset = meta.offsets?.[playerId] ?? 0;
    const opponentsOnTrack = this.buildOpponentTrackIndex(state, playerId);
    if (opponentsOnTrack.size === 0) return null;

    let bestDistance: number | null = null;
    for (const pawn of myPawns) {
      const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
      if (prog < 0 || prog >= meta.trackLength) continue;
      for (let step = 1; step < Math.trunc(roll); step++) {
        const intermediateProgress = prog + step;
        if (intermediateProgress >= meta.trackLength) break;
        const pos = (myOffset + intermediateProgress) % meta.trackLength;
        if (opponentsOnTrack.has(pos)) {
          bestDistance =
            bestDistance == null ? step : Math.min(bestDistance, step);
          break;
        }
      }
    }

    if (bestDistance == null) return null;

    const who = this.playerName(state, playerId);
    return `${who} ne peut pas avancer.`;
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

    const pawn = pawns.find((p: any) => p?.pawnIndex === move.pawnIndex);
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
    const offset = meta.offsets?.[playerId] ?? 0;
    const pawnLabel = this.pawnLabel(state, playerId, move.pawnIndex);
    if (prevProg < 0 && nextProg === 0) {
      const pos = (offset + nextProg) % meta.trackLength;
      const habitat = this.habitatLabel(state, playerId);
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} sort ${pawnLabel} ${this.fromHabitat(habitat)} : case ${pos + 1}/${meta.trackLength}.`,
      );
    } else {
      if (nextProg >= 0 && nextProg < meta.trackLength) {
        const pos = (offset + nextProg) % meta.trackLength;
        next = this.core.appendLog(
          next,
          `${this.playerName(state, playerId)} met ${pawnLabel} en case ${pos + 1}/${meta.trackLength}.`,
        );
      } else {
        const casesWord = rollInt == 1 ? 'case' : 'cases';
        next = this.core.appendLog(
          next,
          `${this.playerName(state, playerId)} avance ${pawnLabel} de ${rollInt} ${casesWord}.`,
        );
      }
    }

    // Messages clairs pour l'entrée dans la maison / arrivée (sans coordonnées "case x/52").
    if (
      prevProg >= 0 &&
      prevProg < meta.trackLength &&
      nextProg >= meta.trackLength
    ) {
      const homeIndex = nextProg - meta.trackLength + 1;
      if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
        next = this.core.appendLog(
          next,
          `${this.playerName(state, playerId)} entre ${pawnLabel} dans l'abri (${homeIndex}/${meta.homeLength}).`,
        );
      }
    }
    const arrivalProgress = meta.trackLength + meta.homeLength - 1;
    if (prevProg < arrivalProgress && nextProg >= arrivalProgress) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} met ${pawnLabel} à l'arrivée.`,
      );
    }

    next = this.applyCapture(next, playerId, move.pawnIndex, nextProg);

    if (this.isWinner(next, playerId, arrivalProgress)) {
      next = this.core.appendLog(
        next,
        `${this.playerName(state, playerId)} a gagné !`,
      );
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
    const isSafe =
      Array.isArray(meta.safeTiles) && meta.safeTiles.includes(moverPos);
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

        const capturedLabel = this.pawnLabel(state, p.id, pawn.pawnIndex);
        next = this.core.appendLog(
          next,
          `${this.playerName(state, moverId)} capture ${this.playerName(state, p.id)} (${capturedLabel}) : retour au départ.`,
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
      const who =
        currentId != null ? this.playerName(state, currentId) : 'Le joueur';
      return this.core.appendLog(state, `6 : ${who} rejoue.`);
    }
    return this.turns.advanceTurn(state);
  }

  private isWinner(
    state: GameStateEntity,
    playerId: number,
    pathLen: number,
  ): boolean {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];
    if (pawns.length !== 4) return false;
    return pawns.every(
      (p: any) => typeof p?.progress === 'number' && p.progress >= pathLen,
    );
  }

  private describeProgress(
    meta: PetitChevauxMetadata,
    playerId: number,
    progress: number,
  ): string {
    if (!Number.isFinite(progress) || progress < 0) {
      return 'départ';
    }
    const arrivalProgress = meta.trackLength + meta.homeLength - 1;
    if (progress >= arrivalProgress) {
      return 'arrivée';
    }
    if (progress < meta.trackLength) {
      const offset = meta.offsets?.[playerId] ?? 0;
      const pos = (offset + progress) % meta.trackLength;
      return `case ${pos + 1}/${meta.trackLength}`;
    }
    const homeIndex = progress - meta.trackLength + 1;
    return `abri ${homeIndex}/${meta.homeLength}`;
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
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const list = meta?.pawnNamesByPlayer?.[playerId];
    const name =
      Array.isArray(list) && typeof list[pawnIndex] === 'string'
        ? String(list[pawnIndex]).trim()
        : '';
    if (name) return name;
    return `animal ${pawnIndex + 1}`;
  }

  private habitatLabel(state: GameStateEntity, playerId: number): string {
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const habitat =
      typeof meta?.habitatByPlayer?.[playerId] === 'string'
        ? String(meta.habitatByPlayer[playerId]).trim()
        : '';
    return habitat || 'abri de départ';
  }

  private fromHabitat(habitat: string): string {
    const raw = String(habitat ?? '').trim();
    const h = raw.toLowerCase();
    if (!raw) return "de l'abri de départ";
    if (h === 'écurie' || h === 'ecurie') return "de l'écurie";
    if (h === 'volière' || h === 'voliere') return 'de la volière';
    if (h === 'primaterie') return 'de la primaterie';
    if (h === 'aquarium') return "de l'aquarium";
    if (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(raw)) {
      return `de l'${raw}`;
    }
    return `du ${raw}`;
  }
}
