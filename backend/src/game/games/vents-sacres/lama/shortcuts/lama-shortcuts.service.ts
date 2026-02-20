import { Injectable } from '@nestjs/common';
import type { GameShortcutHint, GameShortcutsContext } from '../../../../engine/shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';
import { nextLamaValue } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';

@Injectable()
export class LamaShortcutsService {
  constructor(private readonly shared: LamaSharedService) {}

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    if (!ctx?.started) return [];

    const meta: any = ctx?.metadata ?? {};
    const currentPlayerId = ctx?.currentPlayerId ?? null;
    const droppedOutByPlayerId: Record<string, boolean> =
      meta?.droppedOutByPlayerId && typeof meta.droppedOutByPlayerId === 'object'
        ? meta.droppedOutByPlayerId
        : {};
    const drawLocked = Object.values(droppedOutByPlayerId).some((isOut) => Boolean(isOut));
    const currentPlayerDropped = currentPlayerId != null && Boolean(droppedOutByPlayerId[String(currentPlayerId)]);
    const deckCount = Array.isArray(meta?.deck) ? meta.deck.length : 0;
    const allowPlayAfterDraw = Boolean(meta?.allowPlayAfterDraw);
    const tracker = meta?.turnTracker ?? null;
    const isSameTurn = this.shared.asNumberOrNull(tracker?.playerId) === currentPlayerId;
    const canPass =
      allowPlayAfterDraw &&
      isSameTurn &&
      this.shared.asBoolean(tracker?.drawn) &&
      !this.shared.asBoolean(tracker?.played);
    const canDraw =
      isSameTurn &&
      !currentPlayerDropped &&
      !drawLocked &&
      deckCount > 0 &&
      !this.shared.asBoolean(tracker?.drawn);

    const topDiscard =
      Array.isArray(meta?.discard) && meta.discard.length
        ? (meta.discard[meta.discard.length - 1] as any)
        : null;
    const hand: any[] = Array.isArray(meta?.handsByPlayerId?.[String(ctx?.currentPlayerId ?? '')])
      ? meta.handsByPlayerId[String(ctx.currentPlayerId)]
      : [];
    const canActuallyPlayAfterDraw =
      allowPlayAfterDraw &&
      topDiscard != null &&
      hand.some((v) => v === topDiscard || v === nextLamaValue(topDiscard));

    return [
      ...(canDraw ? [actionShortcut('SPACE', 'draw')] : []),
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      ...(canPass && canActuallyPlayAfterDraw ? [actionShortcut('T', 'lama_pass')] : []),
      actionShortcut('P', 'lama_quit'),
    ];
  }
}
