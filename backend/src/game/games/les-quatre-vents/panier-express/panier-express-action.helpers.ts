import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { PanierExpressMetadata } from './model/panier-express-state.entity';
import { asRecord, toText } from './panier-express-state.helpers';

export function handlePanierExpressExchangeChooseTarget(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  chooseTarget: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  const playerId = actorId ?? args.state.turn?.currentPlayerId ?? null;
  const targetPlayerId = args.action.payload?.targetPlayerId ?? null;
  if (typeof playerId !== 'number' || typeof targetPlayerId !== 'number') {
    return args.appendLog(
      args.state,
      "[Panier Express] Choix cible d'échange invalide.",
    );
  }

  return args.chooseTarget(args.state, playerId, targetPlayerId);
}

export function handlePanierExpressExchangeChooseGive(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  chooseGive: (
    state: GameStateEntity,
    playerId: number,
    give: string,
  ) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  const playerId = actorId ?? args.state.turn?.currentPlayerId ?? null;
  const give = args.action.payload?.give ?? null;
  if (typeof playerId !== 'number' || typeof give !== 'string') {
    return args.appendLog(
      args.state,
      "[Panier Express] Choix carte d'échange invalide.",
    );
  }

  return args.chooseGive(args.state, playerId, give);
}

export function handlePanierExpressExchangeAccept(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  acceptOffer: (state: GameStateEntity, actorId: number) => GameStateEntity;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  if (typeof actorId !== 'number') {
    return args.appendLog(
      args.state,
      "[Panier Express] Acceptation d'échange invalide.",
    );
  }

  const resolved = args.acceptOffer(args.state, actorId);
  if (resolved.pending?.type === 'draw') {
    return resolved;
  }
  return args.advanceTurn(resolved);
}

export function handlePanierExpressExchangeRefuse(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPendingRecord: (state: GameStateEntity) => Record<string, unknown> | null;
  refuseOffer: (state: GameStateEntity, actorId: number) => GameStateEntity;
  applyQuiz: (state: GameStateEntity, initiatorId: number) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  if (typeof actorId !== 'number') {
    return args.appendLog(args.state, "[Panier Express] Refus d'échange invalide.");
  }

  const pending = args.getPendingRecord(args.state);
  const pendingCard =
    pending &&
    toText(pending.type) === 'exchange' &&
    toText(pending.step) === 'confirm'
      ? toText(pending.card)
      : '';
  const initiatorId =
    pending &&
    toText(pending.type) === 'exchange' &&
    toText(pending.step) === 'confirm'
      ? Number(pending.initiatorPlayerId)
      : NaN;

  const resolved = args.refuseOffer(args.state, actorId);
  if (pendingCard === 'troc-equitable' && Number.isFinite(initiatorId)) {
    const withQuiz = args.applyQuiz(resolved, initiatorId);
    return args.appendLog(
      withQuiz,
      `[Panier Express] Troc équitable : échange refusé, quiz pour ${args.playerName(args.state, initiatorId)}.`,
    );
  }

  return args.advanceTurn(resolved);
}

export function handlePanierExpressMerchantRequestAccept(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPendingRecord: (state: GameStateEntity) => Record<string, unknown> | null;
  toStringArray: (value: unknown) => string[];
  playerName: (state: GameStateEntity, playerId: number) => string;
  formatCourseLabel: (value: string) => string;
  removeIngredientFromInventory: (
    state: GameStateEntity,
    actorId: number,
    ingredient: string,
  ) => GameStateEntity;
  addCourseToDiscards: (
    state: GameStateEntity,
    ingredient: string,
  ) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  if (typeof actorId !== 'number') {
    return args.appendLog(args.state, '[Panier Express] Acceptation du marchand invalide.');
  }

  const pending = args.getPendingRecord(args.state);
  const pendingData = asRecord(pending?.data);
  const ingredient =
    pending &&
    ((toText(pending.type) === 'merchant_request' && pendingData.kind == null) ||
      (toText(pending.type) === 'pick' &&
        toText(pendingData.kind) === 'merchant_request.choose'))
      ? toText(pendingData.ingredient).trim()
      : '';
  if (!ingredient) {
    return args.appendLog(args.state, '[Panier Express] Acceptation du marchand invalide.');
  }

  const player = (args.state.players ?? []).find((entry) => entry.id === actorId);
  const inventory = player ? args.toStringArray(player.inventory) : [];
  if (!inventory.includes(ingredient)) {
    return args.appendLog(
      args.state,
      `[Panier Express] Case Échange : ${args.playerName(args.state, actorId)} n'a pas "${args.formatCourseLabel(ingredient)}".`,
    );
  }

  let next: GameStateEntity = { ...args.state, pending: null };
  next = args.removeIngredientFromInventory(next, actorId, ingredient);
  next = args.addCourseToDiscards(next, ingredient);
  const label = args.formatCourseLabel(ingredient);
  next = args.appendLog(
    next,
    `[Panier Express] Case Échange : ${args.playerName(next, actorId)} accepte et donne "${label}".`,
  );
  next = args.appendActionLog(next, actorId, 'event', {
    effect: 'merchant_request_accept',
    ingredient,
  });
  return args.advanceTurn(next);
}

export function handlePanierExpressMerchantRequestRefuse(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPendingRecord: (state: GameStateEntity) => Record<string, unknown> | null;
  formatCourseLabel: (value: string) => string;
  playerName: (state: GameStateEntity, playerId: number) => string;
  applySkipTurnTile: (
    state: GameStateEntity,
    actorId: number,
    turns: number,
    silent?: boolean,
  ) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const actorId = args.getActorIdFromAction(args.action);
  if (typeof actorId !== 'number') {
    return args.appendLog(args.state, '[Panier Express] Refus du marchand invalide.');
  }

  const pending = args.getPendingRecord(args.state);
  const pendingData = asRecord(pending?.data);
  const ingredient =
    pending &&
    ((toText(pending.type) === 'merchant_request' && pendingData.kind == null) ||
      (toText(pending.type) === 'pick' &&
        toText(pendingData.kind) === 'merchant_request.choose'))
      ? toText(pendingData.ingredient).trim()
      : '';

  let next: GameStateEntity = { ...args.state, pending: null };
  next = args.applySkipTurnTile(next, actorId, 2, true);
  const label = ingredient ? ` "${args.formatCourseLabel(ingredient)}"` : '';
  next = args.appendLog(
    next,
    `[Panier Express] Case Échange : ${args.playerName(next, actorId)} refuse${label} et perd 2 tours.`,
  );
  next = args.appendActionLog(next, actorId, 'event', {
    effect: 'merchant_request_refuse',
    ingredient: ingredient || null,
  });
  return args.advanceTurn(next);
}

export function handlePanierExpressSkipTurn(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const playerId =
    args.getActorIdFromAction(args.action) ??
    args.action.payload?.playerId ??
    args.state.turn?.currentPlayerId ??
    null;
  if (typeof playerId !== 'number') {
    return args.state;
  }

  const metadata = args.getMetadata(args.state);
  const currentSkip = metadata.statuses.skipTurn?.[playerId] ?? 0;
  const nextSkip = Math.max(0, currentSkip - 1);
  const nextMeta: PanierExpressMetadata = {
    ...metadata,
    statuses: {
      ...metadata.statuses,
      skipTurn: { ...(metadata.statuses.skipTurn ?? {}), [playerId]: nextSkip },
    },
  };
  const next = { ...args.state, metadata: nextMeta };
  const logged = args.appendLog(
    next,
    `[Panier Express] ${args.playerName(args.state, playerId)} passe son tour.`,
  );
  return args.advanceTurn(logged);
}
