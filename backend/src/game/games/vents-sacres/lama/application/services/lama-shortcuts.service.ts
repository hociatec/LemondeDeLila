import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../../shortcuts/public-api';
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
    const allowPlayAfterDrawRaw: unknown = meta.allowPlayAfterDraw;
    const allowPlayAfterDraw =
      allowPlayAfterDrawRaw === true ||
      allowPlayAfterDrawRaw === 1 ||
      String(allowPlayAfterDrawRaw ?? '').toLowerCase() === 'true';
    const canPassTurn =
      allowPlayAfterDraw && isSameTurn && trackerDrawn && !trackerPlayed;

    return [
      // The state presenter removes shortcuts whose action is not exposed to
      // the viewer, so the action list remains the source of truth here.
      actionShortcut('SPACE', 'draw'),
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      actionShortcut('P', canPassTurn ? 'lama_pass' : 'lama_quit'),
    ];
  }
}
