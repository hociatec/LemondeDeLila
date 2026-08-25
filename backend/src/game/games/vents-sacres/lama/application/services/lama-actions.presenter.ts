import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { nextLamaValue, LAMA_VALUE } from '../../model/lama.model';
import { isLamaDrawLocked } from '../policies/lama-draw.policy';
import {
  effectiveLamaStep,
  isLamaSetupState,
} from '../policies/lama-lifecycle.policy';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export class LamaActionsPresenter {
  build(state: GameStateEntity, userId: number): GameSingleActionDto[] {
    const meta = (state.metadata ?? {}) as LamaMetadata;

    if (isLamaSetupState(state)) {
      const ownerId = this.resolveSetupOwnerId(state, meta);
      if (ownerId == null || userId !== ownerId) return [];
      return [{ type: 'lama_set_config', payload: {} }];
    }

    if (effectiveLamaStep(state, meta) === 'round_pause') {
      return [];
    }

    if (!this.isStarted(state)) return [];

    const out: GameSingleActionDto[] = [
      { type: 'lama_peek_discard', payload: {} },
    ];

    const handValues = (
      (meta.handsByPlayerId ?? {})[String(userId)] ?? []
    ).filter((v) => typeof v === 'number' && v >= 1 && v <= LAMA_VALUE);
    const dropped = Boolean((meta.droppedOutByPlayerId ?? {})[String(userId)]);
    const drawLocked = isLamaDrawLocked(meta);
    const sortedHandValues = [...handValues].sort((a, b) => a - b);

    const current = state.turn?.currentPlayerId ?? null;
    if (current !== userId) {
      // Not your turn: allow browsing hand without sending game-altering actions.
      for (const value of sortedHandValues) {
        out.push({ type: 'lama_preview', payload: { value } });
      }
      return out;
    }

    const step = effectiveLamaStep(state, meta);
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
    const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);

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

    const trackerPlayerId = asNumberOrNull(tracker?.playerId);
    const isSameTurn = trackerPlayerId === current;
    const trackerDrawn = asBoolean(tracker?.drawn);
    const trackerPlayed = asBoolean(tracker?.played);

    const turnIndex = Number(state.turnIndex ?? 0);
    const lastDrawMap = meta.lastDrawTurnIndexByPlayerId ?? null;
    const lastDrawIndex =
      lastDrawMap && typeof lastDrawMap === 'object'
        ? asNumberOrNull(lastDrawMap[String(userId)])
        : null;
    const justDrew = lastDrawIndex != null && lastDrawIndex === turnIndex;
    const alreadyDrew = (isSameTurn && trackerDrawn) || justDrew;

    // One action per card in hand (including duplicates), but only expose "play" when legal.
    // This prevents "blocked" turns where the UI suggests an unplayable card that the server ignores.
    for (const value of sortedHandValues) {
      if (!(isSameTurn && trackerPlayed) && allowed.has(value)) {
        out.push({ type: 'lama_play', payload: { value, count: 1 } });
      } else {
        out.push({ type: 'lama_preview', payload: { value } });
      }
    }

    if (!drawLocked && (meta.deck ?? []).length > 0 && !alreadyDrew) {
      out.push({ type: 'draw', payload: {} });
    }

    const allowPlayAfterDraw = Boolean(meta.allowPlayAfterDraw);
    if (allowPlayAfterDraw && alreadyDrew && !trackerPlayed) {
      out.push({ type: 'lama_pass', payload: {} });
    }
    out.push({ type: 'lama_quit', payload: {} });
    return out;
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
