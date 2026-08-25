import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import {
  lamaCardLabel,
  lamaCardScore,
  LAMA_VALUE,
} from '../../model/lama.model';
import { isLamaDrawLocked } from '../policies/lama-draw.policy';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export class LamaPendingPresenter {
  build(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): PendingState | null {
    if (this.isSetup(state) || (metadata.step ?? '') === 'setup_config') {
      const ownerId = this.resolveSetupOwnerId(state, metadata);
      if (ownerId == null || userId !== ownerId) return null;
      return {
        type: 'config_prompt',
        label: 'Configuration LAMA.',
        playerId: ownerId,
        choices: [],
        data: {
          title: 'LAMA',
          actionType: 'lama_set_config',
          fields: [
            {
              key: 'loseAtScore',
              label: 'Score de défaite (jetons)',
              kind: 'number',
              min: 5,
              max: 200,
              initialText: String(metadata.loseAtScore ?? 40),
            },
            {
              key: 'roundPauseSeconds',
              label: 'Pause entre manches (secondes)',
              kind: 'number',
              min: 0,
              max: 120,
              initialText: String(metadata.roundPauseSeconds ?? 2),
            },
            {
              key: 'allowPlayAfterDraw',
              label: 'Autoriser de rejouer après une pioche (oui/non)',
              kind: 'boolean',
              initialText: metadata.allowPlayAfterDraw ? 'oui' : 'non',
            },
            {
              key: 'returnTokenFromRound',
              label: 'Manche à partir de laquelle un jeton peut être rendu',
              kind: 'number',
              min: 1,
              max: 50,
              initialText: String(metadata.returnTokenFromRound ?? 2),
            },
          ],
        },
      };
    }

    if ((metadata.step ?? '') === 'round_pause') {
      const until =
        typeof metadata.roundPauseUntilMs === 'number'
          ? metadata.roundPauseUntilMs
          : null;
      const seconds =
        until != null ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
      return {
        type: 'lama_pause',
        label: `Pause entre manches : prochain round dans ~${seconds}s.`,
        playerId: userId,
        choices: [],
      };
    }

    if (!this.isStarted(state)) return null;
    // Always expose hand + discard top for the viewer (the server is the source of truth).

    const step = metadata.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (metadata.pendingReturnPlayerId !== userId) return null;
      const score = Number(
        (metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0,
      );
      const choices: string[] = [];
      if (score >= 1) choices.push('Rendre 1 jeton');
      if (score >= 10) choices.push('Rendre 1 diamant (10 jetons)');
      choices.push('Ne rien rendre');
      return {
        type: 'lama_return',
        label:
          'Vous avez gagné la manche : rendez 1 jeton ou 1 diamant (10 jetons) si possible.',
        playerId: userId,
        choices,
      };
    }

    const hand = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
    const droppedOut = Boolean(
      (metadata.droppedOutByPlayerId ?? {})[String(userId)],
    );
    const drawLocked = isLamaDrawLocked(metadata);

    const top = this.topDiscard(metadata);
    if (!top) return null;

    const choices = hand
      .slice()
      .filter((v) => typeof v === 'number' && v >= 1 && v <= LAMA_VALUE)
      .sort((a, b) => a - b)
      .map(lamaCardLabel);

    const meScore = Number(
      (metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0,
    );
    const discardTop = lamaCardLabel(top);
    const handScore = [...new Set(hand)].reduce(
      (sum, v) => sum + lamaCardScore(v),
      0,
    );
    return {
      type: currentPlayerId === userId ? 'lama_turn' : 'lama_hand',
      label: droppedOut
        ? `Défausse : ${discardTop}. Vous vous êtes retiré de la manche. Main : ${hand.length} cartes (${handScore} jetons). Total : ${meScore} jetons.`
        : currentPlayerId === userId
          ? `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (${drawLocked ? '↑/↓ choisir, Entrée jouer, P passer, C défausse, E mains, S jetons' : '↑/↓ choisir, Entrée jouer, Espace piocher, P passer, C défausse, E mains, S jetons'})`
          : `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (En attente)`,
      playerId: userId,
      choices,
    };
  }

  private isSetup(state: GameStateEntity): boolean {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    const phase = String(state?.phase ?? '')
      .toLowerCase()
      .trim();
    return status === 'setup' || phase === 'setup';
  }

  private isStarted(state: GameStateEntity): boolean {
    return (
      String(state.status ?? '')
        .toLowerCase()
        .trim() === 'started'
    );
  }

  private topDiscard(meta: LamaMetadata): LamaCardValue | null {
    const discard = meta.discard ?? [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return null;
    if (top < 1 || top > LAMA_VALUE) return null;
    return top;
  }

  private resolveSetupOwnerId(
    state: GameStateEntity,
    metadata: LamaMetadata,
  ): number | null {
    const players = Array.isArray(state?.players) ? state.players : [];
    const playerExists = (id: unknown): id is number =>
      typeof id === 'number' && players.some((p) => Number(p?.id) === id);
    const isBot = (id: number): boolean =>
      players.some((p) => Number(p?.id) === id && p?.isBot === true);

    const metaOwner = metadata?.ownerPlayerId ?? null;
    if (playerExists(metaOwner) && !isBot(metaOwner)) {
      return metaOwner;
    }

    const pendingOwner = Number(asRecord(state?.pending).playerId ?? NaN);
    if (
      Number.isFinite(pendingOwner) &&
      playerExists(pendingOwner) &&
      !isBot(pendingOwner)
    ) {
      return pendingOwner;
    }

    const turnOwner = state?.turn?.currentPlayerId ?? null;
    if (playerExists(turnOwner) && !isBot(turnOwner)) {
      return turnOwner;
    }

    const firstHuman = players.find((p) => p?.id != null && p?.isBot !== true);
    if (typeof firstHuman?.id === 'number') {
      return firstHuman.id;
    }

    return typeof players[0]?.id === 'number' ? players[0].id : null;
  }
}
