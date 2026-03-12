import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { LamaCardValue, LamaMetadata } from '../model/lama.model';
import { nextLamaValue } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';

@Injectable()
export class LamaBotService {
  constructor(private readonly shared: LamaSharedService) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const meta = (state.metadata ?? {}) as LamaMetadata;
    if (meta.winnerId) return [];

    const step = meta.step ?? 'turn_choice';
    if (step === 'round_pause' || step === 'setup_config') {
      return [];
    }
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== botPlayerId) return [];
      const score = Number(
        (meta.scoresByPlayerId ?? {})[String(botPlayerId)] ?? 0,
      );
      if (score >= 10) return [{ type: 'lama_return', payload: { value: 10 } }];
      if (score >= 1) return [{ type: 'lama_return', payload: { value: 1 } }];
      return [{ type: 'lama_return', payload: { value: 0 } }];
    }

    if (meta.droppedOutByPlayerId?.[String(botPlayerId)]) {
      return [];
    }

    const trackerRaw = (meta as any)?.turnTracker ?? null;
    const trackerPlayerId = this.shared.asNumberOrNull(trackerRaw?.playerId);
    const trackerDrawn = this.shared.asBoolean(trackerRaw?.drawn);
    const trackerPlayed = this.shared.asBoolean(trackerRaw?.played);
    const sameTurn = trackerPlayerId === botPlayerId;

    const turnIndex = Number(state.turnIndex ?? 0);
    const lastDrawMap: any = (meta as any)?.lastDrawTurnIndexByPlayerId ?? null;
    const lastDrawIndex =
      lastDrawMap && typeof lastDrawMap === 'object'
        ? this.shared.asNumberOrNull(lastDrawMap[String(botPlayerId)])
        : null;
    const justDrew = lastDrawIndex != null && lastDrawIndex === turnIndex;
    const alreadyDrew = (sameTurn && trackerDrawn) || justDrew;

    const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return [];
    const drawLocked = this.shared.isDrawLocked(meta);

    const canPlayValues = new Set<LamaCardValue>([top, nextLamaValue(top)]);

    const counts = new Map<LamaCardValue, number>();
    for (const v of hand) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    let best: { value: LamaCardValue; count: number } | null = null;
    for (const [value, count] of counts.entries()) {
      if (!canPlayValues.has(value)) continue;
      if (!best || count > best.count) {
        best = { value, count };
      }
    }

    if (best) {
      return [{ type: 'lama_play', payload: { value: best.value, count: 1 } }];
    }

    if (alreadyDrew && !trackerPlayed) {
      if (meta.allowPlayAfterDraw) {
        return [{ type: 'lama_pass', payload: {} }];
      }
      return [{ type: 'lama_quit', payload: {} }];
    }

    if (!drawLocked && (meta.deck ?? []).length > 0) {
      return [{ type: 'draw', payload: {} }];
    }

    return [{ type: 'lama_quit', payload: {} }];
  }
}
