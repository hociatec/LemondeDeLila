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
    const allowPlayAfterDraw = Boolean(meta?.allowPlayAfterDraw);
    const tracker = meta?.turnTracker ?? null;
    const isSameTurn = this.shared.asNumberOrNull(tracker?.playerId) === (ctx?.currentPlayerId ?? null);
    const canPass =
      allowPlayAfterDraw &&
      isSameTurn &&
      this.shared.asBoolean(tracker?.drawn) &&
      !this.shared.asBoolean(tracker?.played);

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
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      ...(canPass && canActuallyPlayAfterDraw ? [actionShortcut('T', 'lama_pass')] : []),
      actionShortcut('P', 'lama_quit'),
    ];
  }
}
