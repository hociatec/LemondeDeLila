import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import type {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from '../model/panier-express-state.model';
import { asRecord, toText, toUnknownArray } from '../panier-express-state.helpers';
import { updatePanierExpressPlayer } from '../panier-express-quiz-move.helpers';
import { resolveBasicPanierExpressPickChoice } from '../panier-express-pick-choice-basic.helpers';
import { resolvePanierExpressExchangePickChoice } from '../panier-express-pick-choice-exchange.helpers';
import { asStringDeckPool } from '../panier-express-deck.helpers';

export function applyPanierExpressPickChoiceAction(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null | undefined;
  getPendingRecord: (state: GameStateEntity) => Record<string, unknown> | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPlayers: (state: GameStateEntity) => PanierExpressPlayer[];
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  toStringArray: (value: unknown) => string[];
  removeOne: (items: string[], value: string) => string[];
  discardMany: (
    pool: PanierExpressMetadata['decks'],
    deckKey: string,
    cards: string[],
  ) => PanierExpressMetadata['decks'];
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  formatCourseLabel: (card: string) => string;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | null };
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  buildTiles: () => Array<{
    type?: string;
    standId?: string;
    label?: string;
    id?: string;
  }>;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  applyMoveDelta: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  handleMerchantRequestAccept: (state: GameStateEntity) => GameStateEntity;
  handleMerchantRequestRefuse: (state: GameStateEntity) => GameStateEntity;
  standCourseCatalog: () => Record<string, unknown>;
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId: string }>,
    label: string,
  ) => GameStateEntity;
  applyExchangeCard: (
    state: GameStateEntity,
    actorId: number,
    targetPlayerId: number,
    card: string,
  ) => GameStateEntity;
  applyQuiz: (state: GameStateEntity, playerId: number) => GameStateEntity;
}): GameStateEntity {
  const actorId =
    input.getActorIdFromAction(input.action) ??
    input.state.turn?.currentPlayerId ??
    null;
  if (typeof actorId !== 'number') return input.state;

  const pending = input.getPendingRecord(input.state);
  if (!pending || pending.type !== 'pick' || pending.playerId !== actorId) {
    return input.appendLog(
      input.state,
      `[Panier Express] Choix invalide (aucun pending).`,
    );
  }

  const index = Number(input.action.payload?.index);
  const choices = toUnknownArray(pending.choices).map((value) => toText(value));
  if (!Number.isFinite(index) || index < 0 || index >= choices.length) {
    return input.appendLog(input.state, `[Panier Express] Choix invalide.`);
  }

  const pendingData = asRecord(pending.data);
  const kind = toText(pendingData.kind).trim();

  const updatePlayer = (
    base: GameStateEntity,
    playerId: number,
    updater: (player: PanierExpressPlayer) => PanierExpressPlayer,
  ): GameStateEntity =>
    updatePanierExpressPlayer(base, input.getPlayers(base), playerId, updater);

  const removeCourseFromPlayer = (
    base: GameStateEntity,
    playerId: number,
    card: string,
  ): { state: GameStateEntity; removed: boolean } => {
    const trimmed = String(card ?? '').trim();
    if (!trimmed) return { state: base, removed: false };
    let removed = false;
    const updated = updatePlayer(base, playerId, (player) => {
      const inventory = input.toStringArray(player.inventory);
      if (inventory.includes(trimmed)) {
        removed = true;
        return { ...player, inventory: input.removeOne(inventory, trimmed) };
      }
      return player;
    });
    return { state: updated, removed };
  };

  const discardCourse = (
    base: GameStateEntity,
    playerId: number,
    card: string,
  ): GameStateEntity => {
    const trimmed = String(card ?? '').trim();
    if (!trimmed) return base;
    const removed = removeCourseFromPlayer(base, playerId, trimmed);
    if (!removed.removed) return base;
    const currentMeta = input.getMetadata(removed.state);
    const nextMeta: PanierExpressMetadata = {
      ...currentMeta,
      discards: {
        ...currentMeta.discards,
        courses: [...(currentMeta.discards?.courses ?? []), trimmed],
      },
    };
    return { ...removed.state, metadata: nextMeta };
  };

  const addCourseToPlayer = (
    base: GameStateEntity,
    playerId: number,
    card: string,
  ): GameStateEntity => {
    const trimmed = String(card ?? '').trim();
    if (!trimmed) return base;
    let kept = false;
    const next = updatePlayer(base, playerId, (player) => {
      const list = input.toStringArray(player.shoppingList);
      const basket = input.toStringArray(player.basket);
      const inventory = input.toStringArray(player.inventory);
      const alreadyInBasket = basket.includes(trimmed);
      const alreadyInInventory = inventory.includes(trimmed);
      const isNeeded = list.includes(trimmed) && !alreadyInBasket;

      if (alreadyInBasket || alreadyInInventory) {
        if (isNeeded && alreadyInInventory) {
          return {
            ...player,
            basket: [...basket, trimmed],
            inventory: input.removeOne(inventory, trimmed),
          };
        }
        return player;
      }

      if (isNeeded) {
        kept = true;
        return { ...player, basket: [...basket, trimmed], inventory };
      }

      if (inventory.length >= 5) {
        return player;
      }

      kept = true;
      return { ...player, inventory: [...inventory, trimmed], basket };
    });
    const nextMeta = input.getMetadata(next);
    const discards = Array.isArray(nextMeta.discards?.courses)
      ? nextMeta.discards.courses.map((value) => String(value))
      : [];
    const withDiscard = kept
      ? next
      : {
          ...next,
          metadata: {
            ...nextMeta,
            discards: {
              ...nextMeta.discards,
              courses: [...discards, trimmed],
            },
          },
        };
    if (!kept) return withDiscard;
    const metaAfter = input.getMetadata(withDiscard);
    return {
      ...withDiscard,
      metadata: {
        ...metaAfter,
        lastObtainedCourse: {
          ...(metaAfter.lastObtainedCourse ?? {}),
          [playerId]: trimmed,
        },
      },
    };
  };

  const clearPending = (state: GameStateEntity): GameStateEntity => ({
    ...state,
    pending: null,
  });

  const basicPickChoiceResolved = resolveBasicPanierExpressPickChoice({
    kind,
    state: input.state,
    actorId,
    index,
    choices,
    pendingData,
    clearPending,
    getMetadata: (state) => input.getMetadata(state),
    asStringDeckPool,
    discardMany: (pool, deckKey, cards) =>
      input.discardMany(asStringDeckPool(pool), deckKey, cards),
    addCourseToPlayer,
    discardCourse,
    removeCourseFromPlayer,
    appendLog: (state, message) => input.appendLog(state, message),
    appendActionLog: (state, playerId, type, payload) =>
      input.appendActionLog(state, playerId, type, payload),
    playerName: (state, playerId) => input.playerName(state, playerId),
    formatCourseLabel: (card) => input.formatCourseLabel(card),
    advanceTurn: (state) => input.advanceTurn(state),
    getPlayers: (state) => input.getPlayers(state),
    toStringArray: (value) => input.toStringArray(value),
    createMetaRng: (metadata) => input.createMetaRng(metadata),
    pickOne: (metadata, items) => input.pickOne(metadata, items),
    ensureMetadata: (state) => input.ensureMetadata(state),
    buildTiles: () => input.buildTiles(),
    movePlayer: (state, playerId, delta) =>
      input.movePlayer(state, playerId, delta),
    resolveTile: (state, playerId) => input.resolveTile(state, playerId),
    advanceAfterDraw: (state) => input.advanceAfterDraw(state),
    applyMoveDelta: (state, playerId, delta) =>
      input.applyMoveDelta(state, playerId, delta),
    handleMerchantRequestAccept: (state) =>
      input.handleMerchantRequestAccept(state),
    handleMerchantRequestRefuse: (state) =>
      input.handleMerchantRequestRefuse(state),
  });
  if (basicPickChoiceResolved) {
    return basicPickChoiceResolved;
  }

  const exchangePickChoiceResolved = resolvePanierExpressExchangePickChoice({
    kind,
    state: input.state,
    actorId,
    index,
    choices,
    pendingData,
    clearPending,
    standCourseCatalog: () => input.standCourseCatalog(),
    getMetadata: (state) => input.getMetadata(state),
    getPlayers: (state) => input.getPlayers(state),
    toStringArray: (value) => input.toStringArray(value),
    playerName: (state, playerId) => input.playerName(state, playerId),
    formatCourseLabel: (card) => input.formatCourseLabel(card),
    appendLog: (state, message) => input.appendLog(state, message),
    appendActionLog: (state, playerId, type, payload) =>
      input.appendActionLog(state, playerId, type, payload),
    addCourseToPlayer,
    discardCourse,
    removeCourseFromPlayer,
    createMetaRng: (metadata) => input.createMetaRng(metadata),
    pickOne: (metadata, items) => input.pickOne(metadata, items),
    advanceTurn: (state) => input.advanceTurn(state),
    queueCourseDraws: (state, tasks, label) =>
      input.queueCourseDraws(state, tasks, label),
    applyExchangeCard: (state, currentActorId, targetPlayerId, card) =>
      input.applyExchangeCard(state, currentActorId, targetPlayerId, card),
    applyQuiz: (state, playerId) => input.applyQuiz(state, playerId),
  });
  if (exchangePickChoiceResolved) {
    return exchangePickChoiceResolved;
  }

  return clearPending(input.state);
}





