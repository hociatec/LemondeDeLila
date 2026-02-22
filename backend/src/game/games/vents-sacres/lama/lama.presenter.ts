import { Injectable } from '@nestjs/common';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { BasePresenterService } from '../../../engine/abstract/base-presenter.service';
import type { LamaCardValue, LamaMetadata } from './model/lama.model';
import {
  lamaCardLabel,
  lamaCardScore,
  nextLamaValue,
  LAMA_VALUE,
} from './model/lama.model';
import { stringOrEmpty } from '@common/utils/string-value.utils';

@Injectable()
export class LamaPresenter extends BasePresenterService {
  private sanitizePlayerName(raw: unknown): string {
    let name = stringOrEmpty(raw).trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const exposed = this.buildExposedStateForUser(state, userId);
    // The internal game log contains the drawn card label. We redact it for opponents,
    // while still letting the drawing player see what they drew.
    const players = Array.isArray(state.players) ? state.players : [];
    const log = this.redactDrawLogForUser(exposed.log, players, userId);
    return { ...exposed, log };
  }

  private isSetup(state: GameStateEntity): boolean {
    return String(state?.status ?? '').toLowerCase() === 'setup';
  }

  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['round'], victory: { type: 'lowest_score' } };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    const meta = (state.metadata ?? {}) as LamaMetadata;

    if (this.isSetup(state) || (meta.step ?? '') === 'setup_config') {
      const ownerId = meta.ownerPlayerId ?? null;
      if (ownerId == null || userId !== ownerId) return [];
      return [{ type: 'lama_set_config', payload: {} }];
    }

    if ((meta.step ?? '') === 'round_pause') {
      return [];
    }

    if (!this.isStarted(state)) return [];

    const out: GameSingleActionDto[] = [
      { type: 'lama_peek_discard', payload: {} },
      { type: 'lama_quit', payload: {} },
    ];

    const handValues = (
      (meta.handsByPlayerId ?? {})[String(userId)] ?? []
    ).filter((v) => typeof v === 'number' && v >= 1 && v <= LAMA_VALUE);
    const dropped = Boolean((meta.droppedOutByPlayerId ?? {})[String(userId)]);
    const drawLocked = Object.values(meta.droppedOutByPlayerId ?? {}).some(
      (isOut) => Boolean(isOut),
    );
    const sortedHandValues = [...handValues].sort((a, b) => a - b);

    const current = state.turn?.currentPlayerId ?? null;
    if (current !== userId) {
      // Not your turn: allow browsing hand without sending game-altering actions.
      for (const value of sortedHandValues) {
        out.push({ type: 'lama_preview', payload: { value } });
      }
      return out;
    }

    const step = meta.step ?? 'turn_choice';
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== userId) return [];
      const score = Number((meta.scoresByPlayerId ?? {})[String(userId)] ?? 0);
      if (score >= 1) out.push({ type: 'lama_return', payload: { value: 1 } });
      if (score >= 10)
        out.push({ type: 'lama_return', payload: { value: 10 } });
      out.push({ type: 'lama_return', payload: { value: 0 } });
      return out;
    }

    if (dropped) return out;

    const top = this.topDiscard(meta);
    if (!top) return out;

    const tracker = meta.turnTracker ?? {
      playerId: current,
      drawn: false,
      played: false,
    };

    const asNumberOrNull = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const asBoolean = (value: unknown): boolean => {
      if (value === true) return true;
      if (value === false) return false;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const t = value.trim().toLowerCase();
        if (
          t === 'true' ||
          t === '1' ||
          t === 'yes' ||
          t === 'oui' ||
          t === 'on'
        )
          return true;
        if (
          t === 'false' ||
          t === '0' ||
          t === 'no' ||
          t === 'non' ||
          t === 'off'
        )
          return false;
      }
      return false;
    };

    const trackerPlayerId = asNumberOrNull((tracker as any)?.playerId);
    const isSameTurn = trackerPlayerId === current;
    const trackerDrawn = asBoolean((tracker as any)?.drawn);
    const trackerPlayed = asBoolean((tracker as any)?.played);

    const turnIndex = Number(state.turnIndex ?? 0);
    const lastDrawMap: any = (meta as any)?.lastDrawTurnIndexByPlayerId ?? null;
    const lastDrawIndex =
      lastDrawMap && typeof lastDrawMap === 'object'
        ? asNumberOrNull(lastDrawMap[String(userId)])
        : null;
    const justDrew = lastDrawIndex != null && lastDrawIndex === turnIndex;
    const alreadyDrew = (isSameTurn && trackerDrawn) || justDrew;

    // One pending choice per card in hand (including duplicates): ENTER plays the selected card (count=1).
    if (!(isSameTurn && trackerPlayed)) {
      for (const value of sortedHandValues) {
        out.push({ type: 'lama_play', payload: { value, count: 1 } });
      }
    }

    if (!drawLocked && (meta.deck ?? []).length > 0 && !alreadyDrew) {
      out.push({ type: 'draw', payload: {} });
    }
    out.push({ type: 'lama_quit', payload: {} });
    return out;
  }

  protected buildPendingState(
    _state: GameStateEntity,
    _metadata: LamaMetadata,
    _currentPlayerId: number | null,
  ): any {
    return null;
  }

  protected buildPendingStateForUser(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): any {
    if (this.isSetup(state) || (metadata.step ?? '') === 'setup_config') {
      const ownerId = metadata.ownerPlayerId ?? null;
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
              label: 'Jetons de défaite',
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
    const drawLocked = Object.values(metadata.droppedOutByPlayerId ?? {}).some(
      (isOut) => Boolean(isOut),
    );

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
          ? `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (${drawLocked ? '↑/↓ choisir, Entrée jouer, P/Q passer, C défausse, E mains, S jetons' : '↑/↓ choisir, Entrée jouer, Espace piocher, P/Q passer, C défausse, E mains, S jetons'})`
          : `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (En attente)`,
      playerId: userId,
      choices,
    };
  }

  protected getActionLabel(actionType: string): string {
    if (actionType === 'lama_play') return 'Jouer';
    if (actionType === 'draw') return 'Piocher';
    if (actionType === 'lama_set_config') return 'Configuration';
    if (actionType === 'lama_quit') return 'Passer (se retirer de la manche)';
    if (actionType === 'lama_pass') return 'Passer (se retirer de la manche)';
    if (actionType === 'lama_return') return 'Rendre jetons';
    if (actionType === 'lama_peek_discard') return 'Voir défausse';
    if (actionType === 'lama_preview') return 'Voir carte';
    return actionType;
  }

  protected buildExtras(
    state: GameStateEntity,
    _metadata: LamaMetadata,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.getBaseExtras(state);
  }

  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const base = this.getBaseExtras(state);
    const players = Array.isArray(state.players) ? state.players : [];

    const handValues = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
    const hand = handValues
      .filter((v) => typeof v === 'number' && v >= 1 && v <= LAMA_VALUE)
      .sort((a, b) => a - b)
      .map(lamaCardLabel);

    const scoreBy = metadata.scoresByPlayerId ?? {};
    const myScore = Number(scoreBy[String(userId)] ?? 0);
    const scoreLines = players
      .filter((p) => p?.id)
      .map((p) => {
        const pid = p.id;
        const s = Number(scoreBy[String(pid)] ?? 0);
        const name = this.sanitizePlayerName(p.username) || `#${pid}`;
        return `${name}: ${s}`;
      });

    const discard = Array.isArray(metadata.discard) ? metadata.discard : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    const discardTop = top ? lamaCardLabel(top) : '(vide)';
    const drawLocked = Object.values(metadata.droppedOutByPlayerId ?? {}).some(
      (isOut) => Boolean(isOut),
    );

    const playableText = (() => {
      if (this.isSetup(state)) {
        const loseAt = metadata.loseAtScore ?? null;
        return loseAt != null
          ? `Réglages: défaite à ${loseAt} jetons.`
          : 'Réglages: choisissez le score de défaite, puis Entrée.';
      }
      if (!this.isStarted(state)) return 'Partie non démarrée.';
      if (currentPlayerId !== userId) return "Ce n'est pas votre tour.";
      const step = metadata.step ?? 'turn_choice';
      if (step === 'return_token')
        return 'Rendez 1 jeton ou 1 diamant (10 jetons) si possible.';
      if (!top) return 'Défausse vide.';
      const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
      const counts = new Map<LamaCardValue, number>();
      for (const v of handValues) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [value, count] of [...counts.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        if (!allowed.has(value)) continue;
        parts.push(`${lamaCardLabel(value)}×${count}`);
      }
      return `Défausse : ${discardTop}. (${drawLocked ? '↑/↓ choisir, Entrée jouer, P/Q passer, C défausse, E mains, S score' : '↑/↓ choisir, Entrée jouer, Espace piocher, P/Q passer, C défausse, E mains, S score'})`;
    })();

    return {
      ...base,
      hand,
      score: [`Total jetons: ${myScore}`, ...scoreLines],
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: hand.length ? `Main: ${hand.join(', ')}` : 'Main: (vide)',
          },
          hands: {
            title: 'Mains',
            message: (() => {
              const by = metadata.handsByPlayerId ?? {};
              const parts = players
                .filter((p) => p?.id)
                .map((p) => {
                  const pid = p.id;
                  const name = this.sanitizePlayerName(p.username) || `#${pid}`;
                  const count = Array.isArray(by[String(pid)])
                    ? (by[String(pid)] as any[]).length
                    : 0;
                  return `${name}: ${count}`;
                });
              return parts.length
                ? `Cartes en main — ${parts.join(', ')}.`
                : 'Cartes en main : inconnues.';
            })(),
          },
          discard: {
            title: 'Défausse',
            message: `Défausse : ${discardTop}.`,
          },
          play: {
            title: 'À jouer',
            message: playableText,
          },
          score: {
            title: 'Jetons',
            message: (() => {
              if (scoreLines.length === 0) return 'Jetons: inconnus.';
              const loseAt =
                metadata.loseAtScore != null
                  ? Number(metadata.loseAtScore)
                  : null;
              const loseText =
                loseAt != null && Number.isFinite(loseAt)
                  ? ` Défaite à ${loseAt} jetons.`
                  : '';
              return `Jetons: ${scoreLines.join(', ')}.${loseText}`;
            })(),
          },
          table: {
            title: 'Table',
            message:
              metadata.loseAtScore != null
                ? `Défaite à ${metadata.loseAtScore} jetons.`
                : 'Défaite: non configurée.',
          },
        },
      },
    };
  }

  private topDiscard(meta: LamaMetadata): LamaCardValue | null {
    const discard = meta.discard ?? [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return null;
    if (top < 1 || top > LAMA_VALUE) return null;
    return top;
  }

  private redactDrawLogForUser(
    log: Array<{ message: string; timestamp?: string }> | undefined,
    players: Array<{ id: number; username?: string }>,
    userId: number,
  ): Array<{ message: string; timestamp?: string }> {
    if (!Array.isArray(log) || log.length === 0)
      return Array.isArray(log) ? [...log] : [];

    const normalize = (raw: unknown): string => this.sanitizePlayerName(raw);
    const keyOf = (raw: unknown): string => normalize(raw).toLowerCase();

    // Build the same label mapping as the game uses when logging actions.
    const idByLabel = new Map<string, number>();
    for (const p of players) {
      const name = normalize(p?.username);
      if (name) idByLabel.set(keyOf(name), p.id);
      idByLabel.set(keyOf(`joueur ${p.id}`), p.id);
    }

    const viewerName = players.find((p) => p?.id === userId)?.username ?? '';
    const viewerKeys = new Set(
      [keyOf(viewerName), keyOf(`joueur ${userId}`)].filter(
        (k) => k.length > 0,
      ),
    );

    const drawRe = /^(.+?) pioche un (.+)\.$/;

    return log.map((entry) => {
      const msg = String(entry?.message ?? '').trim();
      const m = msg.match(drawRe);
      if (!m) return entry;

      const actorLabel = normalize(m[1]);
      const actorKey = keyOf(actorLabel);
      const actorId = idByLabel.get(actorKey) ?? null;

      // Keep the full info for the drawing player (even if ids mismatch, use label as fallback).
      if (actorId === userId || (actorKey && viewerKeys.has(actorKey)))
        return entry;

      return { ...entry, message: `${actorLabel} pioche une carte.` };
    });
  }
}
