import { Injectable } from '@nestjs/common';
import type { GameShortcutHint, GameShortcutsContext } from '../../../../engine/shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';
import { LamaSharedService } from '../shared/lama-shared.service';

@Injectable()
export class LamaShortcutsService {
  constructor(private readonly _shared: LamaSharedService) {}

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
    const tracker = meta?.turnTracker ?? null;
    const trackerPlayerId =
      typeof tracker?.playerId === 'number'
        ? tracker.playerId
        : Number.isFinite(Number(tracker?.playerId))
          ? Number(tracker.playerId)
          : null;
    const trackerDrawn =
      tracker?.drawn === true || tracker?.drawn === 1 || String(tracker?.drawn ?? '').toLowerCase() === 'true';
    const isSameTurn = trackerPlayerId === currentPlayerId;
    const canDraw =
      isSameTurn &&
      !currentPlayerDropped &&
      !drawLocked &&
      deckCount > 0 &&
      !trackerDrawn;

    return [
      ...(canDraw ? [actionShortcut('SPACE', 'draw')] : []),
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      actionShortcut('P', 'lama_quit'),
      actionShortcut('Q', 'lama_quit'),
    ];
  }
}
