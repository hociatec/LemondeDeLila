import type { GameState } from '../../../core/application/models/game-state.model';
import { GameActionRejectedError } from '../../../core/domain/errors/game-domain.errors';

const MAX_COMMAND_RECEIPTS = 256;

export type GameCommandReceipt = {
  commandId: string;
  actorId: number | null;
  actionType: string;
  acceptedAtMs: number;
  resultVersion: number;
  /** Absent on legacy snapshots; their receipt cannot prove an identical retry. */
  requestFingerprint?: string;
};

export type GameCommandJournalState = {
  receipts: GameCommandReceipt[];
};

type StateWithCommandJournal = GameState & {
  engine?: { commands?: GameCommandJournalState };
};

export function createGameCommandJournalState(): GameCommandJournalState {
  return { receipts: [] };
}

export function commandReceipt(
  state: GameState,
  commandId: string,
): GameCommandReceipt | null {
  const journal = (state as StateWithCommandJournal).engine?.commands;
  return (
    journal?.receipts.find((receipt) => receipt.commandId === commandId) ?? null
  );
}

export function recordCommandReceipt(
  state: GameState,
  receipt: GameCommandReceipt,
): void {
  const runtime = state as StateWithCommandJournal;
  if (!runtime.engine) return;
  const journal = (runtime.engine.commands ??= createGameCommandJournalState());
  journal.receipts = [
    ...journal.receipts.filter(
      (candidate) => candidate.commandId !== receipt.commandId,
    ),
    structuredClone(receipt),
  ].slice(-MAX_COMMAND_RECEIPTS);
}

export function assertMatchingCommandReceipt(
  receipt: GameCommandReceipt,
  requestFingerprint: string | undefined,
): void {
  // The digest includes both the authoritative actor and the action type.
  if (
    !receipt.requestFingerprint ||
    receipt.requestFingerprint !== requestFingerprint
  )
    throw new GameActionRejectedError(
      'Identifiant de commande déjà utilisé avec un contenu différent ou invérifiable.',
    );
}

export function normalizeCommandId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length >= 8 && normalized.length <= 128 ? normalized : null;
}
