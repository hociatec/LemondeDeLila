import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import type { GameSingleActionDto } from '../../../../../models/game-action.model';

import { RandomService } from '../../../../../application/services/random.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import {
  FOULEES_FAMILY_PACKS,
  FOULEES_FAMILY_PENDING_LABEL,
  type FouleesFamilyPack,
  toFouleesFamilyChoice,
} from '../../definitions/family.definition';
import type { FouleesFantastiquesMetadata } from '../../model/foulees-fantastiques-state.model';
import { FouleesFantastiquesSetupService } from './foulees-fantastiques-setup.service';
import {
  computeAvailableMoves,
  describePawnProgress,
  hasBlockingOpponent,
  isWinningPlayer,
  type PendingMove,
} from './foulees-fantastiques-moves.utils';
import {
  describeFouleesFromHabitat,
  describeFouleesHabitatLabel,
  describeFouleesOwnedPawnLabel,
  describeFouleesPawnLabel,
  describeFouleesProgress,
  isFouleesWinner,
} from './foulees-fantastiques-action.utils';

type ChooseFamilyPending = PendingState & {
  type: 'choose_family';
  playerId: number;
  data?: {
    familyIds?: string[];
  };
};

type ChoosePawnPending = PendingState & {
  type: 'choose_pawn';
  playerId: number;
  data?: {
    roll?: number;
    moves?: Array<{
      pawnIndex: number;
      targetProgress: number;
    }>;
  };
};

type FamilyChoicePayload = {
  familyId?: string;
  value?: string;
};

type MovePawnPayload = {
  pawnIndex?: number | string;
  targetProgress?: number | string;
};

type FouleesFamilyChoice = ReturnType<typeof toFouleesFamilyChoice>;

export class FouleesFantastiquesActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setup: FouleesFantastiquesSetupService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          choose_family: () => {
            next = this.handleChooseFamily(next, action);
            return next;
          },
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
          move_pawn: () => {
            next = this.handleMovePawn(next, action);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private ensureFamilyPending(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const familyIdByPlayer = meta.familyIdByPlayer ?? {};
    const familyByPlayer = meta.familyByPlayer ?? {};

    const allChosen = players.every((p) => {
      const f = familyIdByPlayer[p.id];
      return typeof f === 'string' && f.trim().length > 0;
    });
    if (allChosen) {
      let next: GameStateEntity = { ...state, phase: 'turn', pending: null };
      const habitatByPlayer = meta.habitatByPlayer ?? {};
      const pawnNamesByPlayer = meta.pawnNamesByPlayer ?? {};
      for (const p of players) {
        const color = meta.colorsByPlayer?.[p.id];
        const family = familyByPlayer[p.id];
        const habitat = habitatByPlayer[p.id];
        const pawns = pawnNamesByPlayer[p.id];
        if (
          !family ||
          !habitat ||
          !Array.isArray(pawns) ||
          pawns.length !== 4
        ) {
          continue;
        }
        next = this.core.appendLog(
          next,
          `${p.username} reÃƒÆ’Ã‚Â§oit les pions ${color}. Famille des ${family} (${habitat}) : ${pawns.join(', ')}.`,
        );
      }
      next = this.core.appendLog(next, 'DÃƒÆ’Ã‚Â©but de partie.');
      return this.appendTurnAnnouncement(next);
    }

    const currentId = state.turn?.currentPlayerId ?? players[0]?.id ?? null;
    if (currentId == null) return state;

    // Si le joueur courant a dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â  choisi, passer au suivant.
    const already = familyIdByPlayer[currentId];
    if (typeof already === 'string' && already.trim().length > 0) {
      const advanced = this.turns.advanceTurn({ ...state, pending: null });
      return this.ensureFamilyPending(advanced);
    }

    const taken = new Set(
      Object.values(familyIdByPlayer)
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
    const available = FOULEES_FAMILY_PACKS.filter((f) => !taken.has(f.id));
    const usable = available.length > 0 ? available : FOULEES_FAMILY_PACKS;
    const usableChoices = usable.map(toFouleesFamilyChoice);

    const pending = this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: currentId,
      isAssigned: (playerId) => {
        const fid = familyIdByPlayer[playerId];
        return typeof fid === 'string' && fid.trim().length > 0;
      },
      pendingType: 'choose_family',
      choices: usableChoices,
      labelForPlayer: () => FOULEES_FAMILY_PENDING_LABEL,
      dataBuilder: (choices) => ({
        familyIds: choices.map((choice) => choice.id),
      }),
    })?.pending as PendingState | null;
    const withPending = { ...state, pending: pending ?? null };
    const prompt = `${resolvePlayerNameFromState(withPending, currentId)} doit choisir une famille d'animaux.`;
    return this.appendLogOnce(withPending, prompt);
  }

  private handleChooseFamily(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const pending = state.pending as ChooseFamilyPending | null;
    if (
      !pending ||
      pending.type !== 'choose_family' ||
      pending.playerId !== currentId
    ) {
      return state;
    }
    const withPrompt = this.appendLogOnce(
      state,
      `${resolvePlayerNameFromState(state, currentId)} doit choisir une famille d'animaux.`,
    );
    const meta = (withPrompt.metadata ?? {}) as FouleesFantastiquesMetadata;

    const payload = (action.payload ?? {}) as FamilyChoicePayload;
    const rawFamily = payload.familyId ?? payload.value;
    const selected = this.setupFlow.resolveChoice(
      rawFamily,
      FOULEES_FAMILY_PACKS.map(toFouleesFamilyChoice),
    ) as FouleesFamilyChoice | null;
    if (!selected) {
      return this.core.appendLog(state, 'Famille invalide.');
    }
    const familyId = String(selected.id ?? '').trim().toLowerCase();
    const pack = FOULEES_FAMILY_PACKS.find((f) => f.id === familyId);
    if (!pack) {
      return this.core.appendLog(state, 'Famille invalide.');
    }

    const familyIdByPlayer = meta.familyIdByPlayer ?? {};
    const takenByOther = Object.entries(familyIdByPlayer).some(([pid, fid]) => {
      const otherId = Number(pid);
      if (!Number.isFinite(otherId) || otherId === currentId) return false;
      return (
        String(fid ?? '')
          .trim()
          .toLowerCase() === familyId
      );
    });
    if (takenByOther) {
      return this.core.appendLog(
        state,
        'Cette famille a dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â  ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© choisie par un autre joueur.',
      );
    }

    const nextMeta: FouleesFantastiquesMetadata = {
      ...meta,
      familyIdByPlayer: {
        ...(meta.familyIdByPlayer ?? {}),
        [currentId]: familyId,
      },
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
    let next: GameStateEntity = {
      ...withPrompt,
      metadata: nextMeta,
      pending: null,
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} choisit la famille des ${pack.family} (${pack.habitat}).`,
    );
    next = this.turns.advanceTurn(next);
    return this.ensureFamilyPending(next);
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    // Tant que les familles ne sont pas choisies, on force l'ÃƒÆ’Ã‚Â©tape de setup.
    if (
      String(state.phase ?? '')
        .toLowerCase()
        .trim() !== 'turn'
    ) {
      return this.ensureFamilyPending(state);
    }

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const rng = this.random.rollDice(meta, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(state, currentId)} lance le dÃƒÆ’Ã‚Â© : "${roll}".`,
    );

    const moves = this.computeMoves(next, currentId, roll);
    if (moves.length === 0) {
      const blockInfo = this.findBlockingOpponent(next, currentId, roll);
      next = this.core.appendLog(
        next,
        blockInfo ??
          `${resolvePlayerNameFromState(state, currentId)} ne peut jouer aucun pion.`,
      );
      return this.endTurn(next, roll === 6);
    }

    if (moves.length === 1) {
      next = this.applyMove(next, currentId, moves[0], roll);
      next = this.setup.recomputeBoardView(next);
      if ((next.metadata as FouleesFantastiquesMetadata | undefined)?.winnerId) {
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
        ? `C'est ÃƒÆ’Ã‚Â  ${resolvePlayerNameFromState(next, currentId)} de choisir un animal ÃƒÆ’Ã‚Â  sortir dans la liste, puis EntrÃƒÆ’Ã‚Â©e.`
        : hasStableExit
          ? `C'est ÃƒÆ’Ã‚Â  ${resolvePlayerNameFromState(next, currentId)} de choisir un animal ÃƒÆ’Ã‚Â  sortir ou ÃƒÆ’Ã‚Â  jouer dans la liste, puis EntrÃƒÆ’Ã‚Â©e.`
          : `C'est ÃƒÆ’Ã‚Â  ${resolvePlayerNameFromState(next, currentId)} de choisir un animal ÃƒÆ’Ã‚Â  jouer dans la liste, puis EntrÃƒÆ’Ã‚Â©e.`;

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

    const pending = state.pending as ChoosePawnPending | null;
    if (
      !pending ||
      pending.type !== 'choose_pawn' ||
      pending.playerId !== currentId
    ) {
      return state;
    }

    const payload = (action?.payload ?? {}) as MovePawnPayload;
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
    if ((next.metadata as FouleesFantastiquesMetadata | undefined)?.winnerId) {
      return next;
    }
    return this.endTurn(next, roll === 6);
  }

  private computeMoves(
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ): PendingMove[] {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
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
        // Abri (maison) : progression spÃƒÆ’Ã‚Â©ciale.
        // RÃƒÆ’Ã‚Â¨gle: pour avancer d'une case dans l'abri, il faut faire le numÃƒÆ’Ã‚Â©ro de la prochaine case.
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
          // RÃƒÆ’Ã‚Â¨gle : l'entrÃƒÆ’Ã‚Â©e dans la maison doit ÃƒÆ’Ã‚Âªtre "pile".
          // On ne peut pas dÃƒÆ’Ã‚Â©passer l'entrÃƒÆ’Ã‚Â©e de maison dans le mÃƒÆ’Ã‚Âªme lancer : il faut arriver exactement ÃƒÆ’Ã‚Â  trackLength.
          if (prog < meta.trackLength && nextProg > meta.trackLength) {
            targetProgress = nextProg === meta.trackLength ? nextProg : null;
          } else {
            targetProgress = nextProg;
          }
        }
      }

      if (targetProgress == null) continue;

      // Nouvelle rÃƒÆ’Ã‚Â¨gle : un pion adverse sur le chemin bloque.
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
          continue; // blocage : 2 pions du mÃƒÆ’Ã‚Âªme joueur sur la mÃƒÆ’Ã‚Âªme case
        }

        // Interdit de finir sur une case safe occupÃƒÆ’Ã‚Â©e par un adversaire (on ne peut pas capturer en safe).
        if (opponentsOnTrack.has(destPos)) {
          const isSafe =
            Array.isArray(meta.safeTiles) && meta.safeTiles.includes(destPos);
          if (isSafe) {
            continue;
          }
        }
      }

      const from = describeFouleesProgress(meta, playerId, prog);
      const to = describeFouleesProgress(meta, playerId, targetProgress);
      const pawnLabel = describeFouleesPawnLabel(state, playerId, pawnIndex);
      moves.push({
        pawnIndex,
        targetProgress,
        label: `${pawnLabel} (${from}) : aller ÃƒÆ’Ã‚Â  ${to}`,
      });
    }

    return moves;
  }

  private buildOpponentTrackIndex(
    state: GameStateEntity,
    viewerPlayerId: number,
  ): Set<number> {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
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
    meta: FouleesFantastiquesMetadata,
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
        // DÃƒÆ’Ã‚Â¨s qu'on quitte la piste, il n'y a plus d'adversaires ÃƒÆ’Ã‚Â  "dÃƒÆ’Ã‚Â©passer" (maison/arrivÃƒÆ’Ã‚Â©e).
        break;
      }

      const pos = (myOffset + intermediateProgress) % meta.trackLength;
      if (!opponentsOnTrack.has(pos)) {
        continue;
      }

      // On a un pion adverse sur le chemin.
      // AutorisÃƒÆ’Ã‚Â© seulement si on tombe exactement dessus (capture => ÃƒÆ’Ã‚Â©tape finale).
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
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
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

    const who = resolvePlayerNameFromState(state, playerId);
    return `${who} ne peut pas avancer.`;
  }

  private applyMove(
    state: GameStateEntity,
    playerId: number,
    move: { pawnIndex: number; targetProgress: number },
    _roll: number,
  ): GameStateEntity {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
      ? meta.pawnsByPlayer[playerId]
      : [];

    const pawn = pawns.find(
      (p: FouleesFantastiquesPawnState) => p?.pawnIndex === move.pawnIndex,
    );
    if (!pawn) return state;

    const prevProg = typeof pawn.progress === 'number' ? pawn.progress : -1;
    const nextProg = move.targetProgress;

    const updatedPawns = pawns.map((p: FouleesFantastiquesPawnState) =>
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

    const offset = meta.offsets?.[playerId] ?? 0;
    const pawnLabel = describeFouleesOwnedPawnLabel(
      state,
      playerId,
      move.pawnIndex,
    );
    if (prevProg < 0 && nextProg === 0) {
      const pos = (offset + nextProg) % meta.trackLength;
      const habitat = describeFouleesHabitatLabel(state, playerId);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(state, playerId)} sort ${pawnLabel} ${describeFouleesFromHabitat(habitat)} et le place en case ${pos + 1}.`,
      );
    } else {
      if (nextProg >= 0 && nextProg < meta.trackLength) {
        const pos = (offset + nextProg) % meta.trackLength;
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(state, playerId)} place ${pawnLabel} en case ${pos + 1}.`,
        );
      } else {
        const homeIndex = nextProg - meta.trackLength + 1;
        if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(state, playerId)} met ${pawnLabel} dans l'abri (${homeIndex}/${meta.homeLength}).`,
          );
        }
      }
    }

    // Messages clairs pour l'entrÃƒÆ’Ã‚Â©e dans la maison / arrivÃƒÆ’Ã‚Â©e (sans coordonnÃƒÆ’Ã‚Â©es "case x/52").
    if (
      prevProg >= 0 &&
      prevProg < meta.trackLength &&
      nextProg >= meta.trackLength
    ) {
      const homeIndex = nextProg - meta.trackLength + 1;
      if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(state, playerId)} entre ${pawnLabel} dans l'abri (${homeIndex}/${meta.homeLength}).`,
        );
      }
    }
    const arrivalProgress = meta.trackLength + meta.homeLength - 1;
    if (prevProg < arrivalProgress && nextProg >= arrivalProgress) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(state, playerId)} met ${pawnLabel} ÃƒÆ’Ã‚Â  l'arrivÃƒÆ’Ã‚Â©e.`,
      );
    }

    next = this.applyCapture(next, playerId, move.pawnIndex, nextProg);

    if (this.isWinner(next, playerId, arrivalProgress)) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(state, playerId)} a gagnÃƒÆ’Ã‚Â© !`,
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
    _moverPawnIndex: number,
    moverProgress: number,
  ): GameStateEntity {
    const baseMeta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    if (!(typeof moverProgress === 'number')) return state;
    if (moverProgress < 0 || moverProgress >= baseMeta.trackLength)
      return state;

    const moverOffset = baseMeta.offsets?.[moverId] ?? 0;
    const moverPos = (moverOffset + moverProgress) % baseMeta.trackLength;
    const isSafe =
      Array.isArray(baseMeta.safeTiles) &&
      baseMeta.safeTiles.includes(moverPos);
    if (isSafe) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    let next = state;

    for (const p of players) {
      if (p.id === moverId) continue;
      const meta = (next.metadata ?? {}) as FouleesFantastiquesMetadata;
      const pawnsByPlayer = meta.pawnsByPlayer ?? {};
      const offset = meta.offsets?.[p.id] ?? 0;
      const pawns = Array.isArray(pawnsByPlayer?.[p.id])
        ? pawnsByPlayer[p.id]
        : [];

      let changed = false;
      const updated = pawns.map((pawn: FouleesFantastiquesPawnState) => {
        const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
        if (prog < 0 || prog >= meta.trackLength) return pawn;
        const pos = (offset + prog) % meta.trackLength;
        if (pos !== moverPos) return pawn;

        const capturedLabel = describeFouleesPawnLabel(
          state,
          p.id,
          pawn.pawnIndex,
        );
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(state, moverId)} capture ${resolvePlayerNameFromState(state, p.id)} (${capturedLabel}) : retour au dÃƒÆ’Ã‚Â©part.`,
        );
        changed = true;
        return { ...pawn, progress: -1 };
      });

      if (changed) {
        next = {
          ...next,
          metadata: {
            ...(next.metadata ?? {}),
            ...meta,
            pawnsByPlayer: { ...pawnsByPlayer, [p.id]: updated },
          },
        };
      }
    }

    return next;
  }

  private endTurn(state: GameStateEntity, extraTurn: boolean): GameStateEntity {
    if (extraTurn) {
      const currentId = state.turn?.currentPlayerId ?? null;
      const who =
        currentId != null
          ? resolvePlayerNameFromState(state, currentId)
          : 'Le joueur';
      const next = this.core.appendLog(state, `${who} rejoue.`);
      return this.appendTurnAnnouncement(next);
    }
    const advanced = this.turns.advanceTurn(state);
    return this.appendTurnAnnouncement(advanced);
  }

  private appendTurnAnnouncement(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) {
      return state;
    }
    const message = `C'est au tour de ${resolvePlayerNameFromState(state, currentId)}.`;
    return this.appendLogOnce(state, message);
  }

  private appendLogOnce(
    state: GameStateEntity,
    message: string,
  ): GameStateEntity {
    const log = Array.isArray(state.log) ? state.log : [];
    const lastMessage = String(log[log.length - 1]?.message ?? '').trim();
    if (lastMessage === message) {
      return state;
    }
    return this.core.appendLog(state, message);
  }

  private isWinner(
    state: GameStateEntity,
    playerId: number,
    pathLen: number,
  ): boolean {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    return isFouleesWinner(meta, playerId, pathLen);
  }

  private describeProgress(
    meta: FouleesFantastiquesMetadata,
    playerId: number,
    progress: number,
  ): string {
    if (!Number.isFinite(progress) || progress < 0) {
      return 'dÃƒÆ’Ã‚Â©part';
    }
    const arrivalProgress = meta.trackLength + meta.homeLength - 1;
    if (progress >= arrivalProgress) {
      return 'arrivÃƒÆ’Ã‚Â©e';
    }
    if (progress < meta.trackLength) {
      const offset = meta.offsets?.[playerId] ?? 0;
      const pos = (offset + progress) % meta.trackLength;
      return `case ${pos + 1}/${meta.trackLength}`;
    }
    const homeIndex = progress - meta.trackLength + 1;
    return `abri ${homeIndex}/${meta.homeLength}`;
  }

  private pawnOwnedLabel(
    state: GameStateEntity,
    playerId: number,
    pawnIndex: number,
  ): string {
    const base = describeFouleesPawnLabel(state, playerId, pawnIndex);
    const trimmed = String(base ?? '').trim();
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('son ') ||
      lower.startsWith('sa ') ||
      lower.startsWith('ses ')
    ) {
      return trimmed;
    }
    return `son ${trimmed || `animal ${pawnIndex + 1}`}`;
  }

  private habitatLabel(state: GameStateEntity, playerId: number): string {
    const meta = (state.metadata ?? {}) as FouleesFantastiquesMetadata;
    const habitat =
      typeof meta?.habitatByPlayer?.[playerId] === 'string'
        ? String(meta.habitatByPlayer[playerId]).trim()
        : '';
    return habitat || 'abri de dÃƒÆ’Ã‚Â©part';
  }

  private fromHabitat(habitat: string): string {
    const raw = String(habitat ?? '').trim();
    const h = raw.toLowerCase();
    if (!raw) return "de l'abri de dÃƒÆ’Ã‚Â©part";
    if (h === 'ÃƒÆ’Ã‚Â©curie' || h === 'ecurie') return "de l'ÃƒÆ’Ã‚Â©curie";
    if (h === 'voliÃƒÆ’Ã‚Â¨re' || h === 'voliere') return 'de la voliÃƒÆ’Ã‚Â¨re';
    if (h === 'primaterie') return 'de la primaterie';
    if (h === 'aquarium') return "de l'aquarium";
    if (/^[aeiouyhÃƒÆ’Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÆ’Ã‚Â¤ÃƒÆ’Ã‚Â©ÃƒÆ’Ã‚Â¨ÃƒÆ’Ã‚ÂªÃƒÆ’Ã‚Â«ÃƒÆ’Ã‚Â®ÃƒÆ’Ã‚Â¯ÃƒÆ’Ã‚Â´ÃƒÆ’Ã‚Â¶ÃƒÆ’Ã‚Â¹ÃƒÆ’Ã‚Â»ÃƒÆ’Ã‚Â¼]/i.test(raw)) {
      return `de l'${raw}`;
    }
    return `du ${raw}`;
  }
}





