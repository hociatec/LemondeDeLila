import type { GameStateEntity } from '../models/game-state.model';

const MAX_COMMAND_RECEIPTS = 256;

export type GameCommandReceipt = {
  commandId: string;
  actorId: number | null;
  actionType: string;
  acceptedAtMs: number;
  resultVersion: number;
};

export type GameCommandJournalState = {
  receipts: GameCommandReceipt[];
};

type StateWithCommandJournal = GameStateEntity & {
  engine?: { commands?: GameCommandJournalState };
};

export function createGameCommandJournalState(): GameCommandJournalState {
  return { receipts: [] };
}

export function commandReceipt(
  state: GameStateEntity,
  commandId: string,
): GameCommandReceipt | null {
  const journal = (state as StateWithCommandJournal).engine?.commands;
  return (
    journal?.receipts.find((receipt) => receipt.commandId === commandId) ?? null
  );
}

export function recordCommandReceipt(
  state: GameStateEntity,
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

export function normalizeCommandId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length >= 8 && normalized.length <= 128
    ? normalized
    : null;
}
