import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../../application/helpers/shortcut-utils';
import { LamaSharedService } from './lama-shared.service';
import type { LamaMetadata } from '../../model/lama.model';
import { isLamaDrawLocked } from '../policies/lama-draw.policy';

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
      meta.droppedOutByPlayerId && typeof meta.droppedOutByPlayerId === 'object'
        ? meta.droppedOutByPlayerId
        : {};
    const drawLocked = isLamaDrawLocked(meta as LamaMetadata);
    const currentPlayerDropped =
      currentPlayerId != null &&
      Boolean(droppedOutByPlayerId[String(currentPlayerId)]);
    const deckCount = Array.isArray(meta.deck) ? meta.deck.length : 0;
    const tracker = meta.turnTracker ?? null;
    const trackerPlayerIdRaw: unknown = tracker?.playerId;
    const trackerDrawnRaw: unknown = tracker?.drawn;
    const trackerPlayedRaw: unknown = tracker?.played;
    const trackerPlayerId =
      typeof trackerPlayerIdRaw === 'number'
        ? trackerPlayerIdRaw
        : Number.isFinite(Number(trackerPlayerIdRaw))
          ? Number(trackerPlayerIdRaw)
          : null;
    const trackerDrawn =
      trackerDrawnRaw === true ||
      trackerDrawnRaw === 1 ||
      String(trackerDrawnRaw ?? '').toLowerCase() === 'true';
    const trackerPlayed =
      trackerPlayedRaw === true ||
      trackerPlayedRaw === 1 ||
      String(trackerPlayedRaw ?? '').toLowerCase() === 'true';
    const isSameTurn = trackerPlayerId === currentPlayerId;
    const canDraw =
      isSameTurn &&
      !currentPlayerDropped &&
      !drawLocked &&
      deckCount > 0 &&
      !trackerDrawn;

    const allowPlayAfterDrawRaw: unknown = meta.allowPlayAfterDraw;
    const allowPlayAfterDraw =
      allowPlayAfterDrawRaw === true ||
      allowPlayAfterDrawRaw === 1 ||
      String(allowPlayAfterDrawRaw ?? '').toLowerCase() === 'true';
    const canPassTurn =
      allowPlayAfterDraw && isSameTurn && trackerDrawn && !trackerPlayed;

    return [
      ...(canDraw ? [actionShortcut('SPACE', 'draw')] : []),
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      actionShortcut('P', canPassTurn ? 'lama_pass' : 'lama_quit'),
    ];
  }
}
