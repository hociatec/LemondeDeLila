import type { PlayerStateEntity } from '../../../../../core/application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { LAMA_VALUE } from '../../model/lama.model';

export class LamaRoundRules {
  isRoundEnded(meta: LamaMetadata, _players: PlayerStateEntity[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 0) return true;
    return false;
  }

  findNextActivePlayerId(
    players: PlayerStateEntity[],
    meta: LamaMetadata,
    afterPlayerId: number,
  ): number | null {
    const ids = players
      .map((p) => p?.id)
      .filter((id) => typeof id === 'number');
    if (!ids.length) return null;
    const start = Math.max(0, ids.indexOf(afterPlayerId));
    const dropped = meta.droppedOutByPlayerId ?? {};
    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length];
      if (!dropped[String(pid)]) return pid;
    }
    return ids[start] ?? null;
  }

  findRoundWinnerId(
    meta: LamaMetadata,
    players: PlayerStateEntity[],
  ): number | null {
    const empty = this.findEmptyHandWinnerId(meta, players);
    if (empty != null) return empty;

    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 1) return Number(active[0]);
    return null;
  }

  buildDeck(copiesPerCardValue: number): LamaCardValue[] {
    const deck: LamaCardValue[] = [];
    for (const v of [1, 2, 3, 4, 5, 6, LAMA_VALUE] as LamaCardValue[]) {
      for (let i = 0; i < copiesPerCardValue; i += 1) deck.push(v);
    }
    return deck;
  }

  private findEmptyHandWinnerId(
    meta: LamaMetadata,
    players: PlayerStateEntity[],
  ): number | null {
    const hands = meta.handsByPlayerId ?? {};
    const ids = players
      .map((p) => p?.id)
      .filter((id) => typeof id === 'number');
    for (const pid of ids) {
      const hand = hands[String(pid)] ?? [];
      if (hand.length === 0) return pid;
    }
    return null;
  }

  shouldPromptReturn(
    roundNumber: number,
    winnerScore: number,
    returnTokenFromRound: number | null | undefined,
  ): boolean {
    if (winnerScore < 1) return false;
    return (
      roundNumber >= this.resolveReturnTokenFromRound(returnTokenFromRound)
    );
  }

  resolveStartingHandSize(value: number | null | undefined): number {
    const parsed = Number(value ?? 6);
    if (!Number.isFinite(parsed)) return 6;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 20) return 6;
    return rounded;
  }

  resolveCopiesPerCardValue(value: number | null | undefined): number {
    const parsed = Number(value ?? 8);
    if (!Number.isFinite(parsed)) return 8;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 20) return 8;
    return rounded;
  }

  private resolveReturnTokenFromRound(
    value: number | null | undefined,
  ): number {
    const parsed = Number(value ?? 2);
    if (!Number.isFinite(parsed)) return 2;
    const rounded = Math.floor(parsed);
    if (rounded < 1 || rounded > 50) return 2;
    return rounded;
  }

  buildEliminatedByScore(
    players: PlayerStateEntity[],
    scoresByPlayerId: Record<string, number>,
    loseAtScore: number,
    previous: Record<string, boolean>,
  ): Record<string, boolean> {
    const out: Record<string, boolean> = { ...(previous ?? {}) };
    for (const p of players) {
      const pid = p?.id;
      if (!pid) continue;
      const score = Number(scoresByPlayerId[String(pid)] ?? 0);
      out[String(pid)] = score >= loseAtScore;
    }
    return out;
  }

  findNextSurvivorStarterIndex(
    players: PlayerStateEntity[],
    eliminatedByPlayerId: Record<string, boolean>,
    afterIndex: number,
  ): number {
    if (!Array.isArray(players) || players.length === 0) {
      return 0;
    }

    const length = players.length;
    const start = Number.isFinite(afterIndex) ? afterIndex : -1;
    for (let step = 1; step <= length; step += 1) {
      const idx = (((start + step) % length) + length) % length;
      const pid = players[idx]?.id;
      if (!pid) continue;
      if (!eliminatedByPlayerId[String(pid)]) {
        return idx;
      }
    }

    return 0;
  }
}
