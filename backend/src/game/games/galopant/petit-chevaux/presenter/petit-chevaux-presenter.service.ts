import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import * as PetitChevauxRulebook from '../rulebook/rulebook';
import { PETIT_CHEVAUX_GAME } from '../definitions/game.definition';
import type { PetitChevauxMetadata } from '../model/petit-chevaux-state.entity';
import { buildPetitChevauxShortcuts } from '../petit-chevaux.shortcuts';

@Injectable()
export class PetitChevauxPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const actions = PetitChevauxRulebook.getAvailableActions(state, userId);
    const meta = (state.metadata ?? {}) as any as PetitChevauxMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const me = players.find((p) => p?.id === userId);

    const pathLen = (meta.trackLength ?? 0) + (meta.homeLength ?? 0);
    const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
      ? meta.pawnsByPlayer[userId]
      : [];
    const myColor = meta.colorsByPlayer?.[userId];

    const inStable = myPawns.filter((p: any) => (p?.progress ?? -1) < 0).length;
    const inHome = myPawns.filter(
      (p: any) =>
        typeof p?.progress === 'number' &&
        p.progress >= meta.trackLength &&
        p.progress < pathLen,
    ).length;
    const finished = myPawns.filter(
      (p: any) => (p?.progress ?? -1) >= pathLen,
    ).length;
    const out = myPawns.filter(
      (p: any) =>
        typeof p?.progress === 'number' &&
        p.progress >= 0 &&
        p.progress < meta.trackLength,
    );

    const stableLines: string[] = [];
    if (myColor) stableLines.push(`Couleur: ${myColor}.`);
    stableLines.push(`Écurie: ${inStable}/4.`);
    stableLines.push(`Maison: ${inHome}/4.`);
    stableLines.push(`Arrivés: ${finished}/4.`);

    if (out.length) {
      const offset = meta.offsets?.[userId] ?? 0;
      for (const pawn of out) {
        const pos = (offset + pawn.progress) % meta.trackLength;
        stableLines.push(
          `Cheval ${pawn.pawnIndex + 1}: case ${pos + 1}/${meta.trackLength}.`,
        );
      }
    } else {
      stableLines.push('Aucun cheval sorti.');
    }

    const positionLines: string[] = [];
    if (out.length) {
      const offset = meta.offsets?.[userId] ?? 0;
      for (const pawn of out) {
        const pos = (offset + pawn.progress) % meta.trackLength;
        positionLines.push(
          `Cheval ${pawn.pawnIndex + 1}: tour 0, case ${pos + 1}/${meta.trackLength}.`,
        );
      }
    } else {
      positionLines.push('Aucun cheval sorti.');
    }

    const extras = {
      ...(state as any).extras,
      currentPlayerView: {
        id: userId,
        username: me?.username ?? `Joueur ${userId}`,
        stable: stableLines,
        position: positionLines,
      },
      shortcuts: buildPetitChevauxShortcuts({
        metadata: meta as any,
        currentPlayerId: userId,
        started: true,
      }),
    };

    // Ne pas exposer le pending (liste de choix) aux autres joueurs :
    // c'est une décision à prendre uniquement par `pending.playerId`.
    const pendingForUser =
      state.pending && typeof (state.pending as any)?.playerId === 'number'
        ? (state.pending as any).playerId === userId
          ? state.pending
          : null
        : (state.pending ?? null);

    return {
      ...state,
      catalog: {
        phases: PETIT_CHEVAUX_GAME.phaseOrder.map((p) => p.id),
        victory: null,
      },
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: pendingForUser,
      extras,
      board: {
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
        laps: meta.laps ?? {},
      },
    } as any;
  }
}
