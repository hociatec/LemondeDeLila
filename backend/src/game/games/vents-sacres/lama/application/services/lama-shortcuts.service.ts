import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../../application/helpers/shortcut-utils';
import { LamaSharedService } from './lama-shared.service';
import type { LamaMetadata } from '../../model/lama.model';

function asLamaMetadata(value: unknown): Partial<LamaMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<LamaMetadata>)
    : {};
}

export class LamaShortcutsService {
  constructor(private readonly shared: LamaSharedService) {}

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    if (!ctx?.started) return [];

    const meta = asLamaMetadata(ctx?.metadata);
    const currentPlayerId = ctx?.currentPlayerId ?? null;
    const droppedOutByPlayerId: Record<string, boolean> =
      meta.droppedOutByPlayerId &&
      typeof meta.droppedOutByPlayerId === 'object'
        ? meta.droppedOutByPlayerId
        : {};
    const drawLocked = this.shared.isDrawLocked(meta as LamaMetadata);
    const currentPlayerDropped =
      currentPlayerId != null &&
      Boolean(droppedOutByPlayerId[String(currentPlayerId)]);
    const deckCount = Array.isArray(meta.deck) ? meta.deck.length : 0;
    const tracker = meta.turnTracker ?? null;
    const trackerPlayerId =
      typeof tracker?.playerId === 'number'
        ? tracker.playerId
        : Number.isFinite(Number(tracker?.playerId))
          ? Number(tracker.playerId)
          : null;
    const trackerDrawn =
      tracker?.drawn === true ||
      tracker?.drawn === 1 ||
      String(tracker?.drawn ?? '').toLowerCase() === 'true';
    const trackerPlayed =
      tracker?.played === true ||
      tracker?.played === 1 ||
      String(tracker?.played ?? '').toLowerCase() === 'true';
    const isSameTurn = trackerPlayerId === currentPlayerId;
    const canDraw =
      isSameTurn &&
      !currentPlayerDropped &&
      !drawLocked &&
      deckCount > 0 &&
      !trackerDrawn;

    const allowPlayAfterDraw =
      meta.allowPlayAfterDraw === true ||
      meta.allowPlayAfterDraw === 1 ||
      String(meta.allowPlayAfterDraw ?? '').toLowerCase() === 'true';
    const canPassTurn =
      allowPlayAfterDraw && isSameTurn && trackerDrawn && !trackerPlayed;

    return [
      ...(canDraw ? [actionShortcut('SPACE', 'draw')] : []),
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      actionShortcut('P', canPassTurn ? 'lama_pass' : 'lama_quit'),
      actionShortcut('Q', 'lama_quit'),
    ];
  }
}

