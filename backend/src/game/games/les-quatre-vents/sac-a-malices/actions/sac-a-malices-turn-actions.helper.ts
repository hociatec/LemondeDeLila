import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type { SacMetadata, SacTile } from '../model/sac-a-malices.types';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toNumberValue(value: unknown): number | null {
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(candidate) ? candidate : null;
}

export function applySacAMalicesBuyDecision(input: {
  state: GameStateEntity;
  accept: boolean;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getPurchasePrice: (meta: SacMetadata, tile: SacTile) => number;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setOwner: (
    state: GameStateEntity,
    tileIndex: number,
    playerId: number,
  ) => GameStateEntity;
  checkWinner: (state: GameStateEntity) => GameStateEntity;
  getWinnerId: (state: GameStateEntity) => number | null;
  advanceTurnOrExtraRoll: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  if (String(input.state.status ?? '').toLowerCase() !== 'started') {
    return input.state;
  }

  const pending = input.state.pending;
  const pendingRow = asRecord(pending);
  if (!pending || pendingRow.type !== 'buy') return input.state;

  const playerId =
    typeof pendingRow.playerId === 'number'
      ? pendingRow.playerId
      : (input.state.turn?.currentPlayerId ?? null);
  if (playerId == null) return input.state;

  const pendingData = asRecord(pendingRow.data);
  const tileIndex = toNumberValue(pendingData.tileIndex);
  if (tileIndex == null || !Number.isFinite(tileIndex)) return input.state;

  let next: GameStateEntity = { ...input.state, pending: null };
  if (!input.accept) {
    next = input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} n'achète pas.`,
    );
    next = input.checkWinner(next);
    if (input.getWinnerId(next) != null) return { ...next, status: 'finished' };
    return input.advanceTurnOrExtraRoll(next, playerId);
  }

  const meta = input.getMeta(next);
  const tile = meta.tiles?.[tileIndex];
  if (!tile) return input.advanceTurnOrExtraRoll(next, playerId);

  if (meta.ownership?.[tileIndex] != null) {
    next = input.appendLog(next, 'Déjà acheté.');
    return input.advanceTurnOrExtraRoll(next, playerId);
  }

  const price = input.getPurchasePrice(meta, tile);
  if (price <= 0) {
    next = input.appendLog(next, 'Achat impossible (prix inconnu).');
    return input.advanceTurnOrExtraRoll(next, playerId);
  }

  const cash = meta.money?.[playerId] ?? 0;
  if (cash < price) {
    next = input.appendLog(next, 'Fonds insuffisants.');
    return input.advanceTurnOrExtraRoll(next, playerId);
  }

  next = input.addMoney(next, playerId, -price, { toPot: false });
  next = input.setOwner(next, tileIndex, playerId);
  next = input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, playerId)} achète "${tile.title}" pour ${price} €.`,
  );

  next = input.checkWinner(next);
  if (input.getWinnerId(next) != null) return { ...next, status: 'finished' };
  return input.advanceTurnOrExtraRoll(next, playerId);
}

export function applySacAMalicesPayFine(input: {
  state: GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getAutoFine: (state: GameStateEntity) => number;
  isPayFineAllowed: (state: GameStateEntity) => boolean;
  getJailTurns: (state: GameStateEntity, playerId: number) => number;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setJailTurns: (
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ) => GameStateEntity;
  checkWinner: (state: GameStateEntity) => GameStateEntity;
  getWinnerId: (state: GameStateEntity) => number | null;
}): GameStateEntity {
  if (String(input.state.status ?? '').toLowerCase() !== 'started') {
    return input.state;
  }
  if (input.state.pending) return input.state;

  const playerId = input.state.turn?.currentPlayerId ?? null;
  if (playerId == null) return input.state;

  const fine = input.getAutoFine(input.state);
  if (!input.isPayFineAllowed(input.state) || fine <= 0) {
    return input.appendLog(
      input.state,
      'Sortie de prison par amende : indisponible dans cette variante.',
    );
  }

  if (input.getJailTurns(input.state, playerId) <= 0) return input.state;

  let next = input.state;
  next = input.appendLog(next, `Prison : vous payez ${fine} € pour sortir.`);
  next = input.addMoney(next, playerId, -fine, { toPot: true });
  next = input.setJailTurns(next, playerId, 0);
  next = input.checkWinner(next);
  if (input.getWinnerId(next) != null) return { ...next, status: 'finished' };
  return next;
}

export function applySacAMalicesUseJailCard(input: {
  state: GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getJailTurns: (state: GameStateEntity, playerId: number) => number;
  getJailCardCount: (state: GameStateEntity, playerId: number) => number;
  setGetOutOfJail: (
    state: GameStateEntity,
    playerId: number,
    count: number,
  ) => GameStateEntity;
  setJailTurns: (
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ) => GameStateEntity;
}): GameStateEntity {
  if (String(input.state.status ?? '').toLowerCase() !== 'started') {
    return input.state;
  }
  if (input.state.pending) return input.state;

  const playerId = input.state.turn?.currentPlayerId ?? null;
  if (playerId == null) return input.state;

  if (input.getJailTurns(input.state, playerId) <= 0) return input.state;

  const count = input.getJailCardCount(input.state, playerId);
  if (count <= 0) {
    return input.appendLog(
      input.state,
      'Vous n’avez pas de carte "Sortie de prison".',
    );
  }

  let next = input.state;
  next = input.appendLog(next, 'Carte "Sortie de prison" utilisée.');
  next = input.setGetOutOfJail(next, playerId, count - 1);
  next = input.setJailTurns(next, playerId, 0);
  return next;
}




