import type {
  GameStateEntity,
  PendingState,
} from '../../../../application/models/game-state.model';
import type { DeckPoolState } from '../../../../application/services/deck-pool.service';
import type {
  PanierExpressDeckPool,
  PanierExpressMetadata,
  PanierExpressPlayer,
} from '../model/panier-express-state.model';
import {
  addPanierExpressCourseToDiscard,
  addPanierExpressCourseToPlayer,
  discardPanierExpressRandomCourse,
  getPanierExpressDiscardCourses,
  removePanierExpressCourseFromPlayer,
  setPanierExpressPickPending,
} from '../panier-express-event-state.helpers';
import {
  buildPanierExpressEventTargetChoices,
  buildPanierExpressEventTargets,
} from '../panier-express-draw.helpers';
import { applyBasicPanierExpressEvent } from '../panier-express-event-basic.helpers';
import { applyAdvancedPanierExpressEvent } from '../panier-express-event-advanced.helpers';

type MetaRngState = { getMeta: () => PanierExpressMetadata };
type PickOneResult<T> = { value: T | null; meta: PanierExpressMetadata };
type PendingStateLike = PendingState;

export function applyPanierExpressEventAction(input: {
  state: GameStateEntity;
  playerId: number;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  drawFromPool: (
    meta: PanierExpressMetadata,
    key: string,
  ) => { card: string | undefined; metadata: PanierExpressMetadata };
  refillEventDeck: (meta: PanierExpressMetadata) => PanierExpressDeckPool;
  formatEventLabel: (event: string) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  getPlayers: (state: GameStateEntity) => PanierExpressPlayer[];
  toStringArray: (value: unknown) => string[];
  playerName: (state: GameStateEntity, playerId: number) => string;
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ) => GameStateEntity;
  applyMoveDelta: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  startDrawPending: (
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
    label: string,
  ) => GameStateEntity;
  setTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
    amount: number,
  ) => GameStateEntity;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
  moveCircular: (
    length: number,
    currentPosition: number,
    delta: number,
  ) => number;
  createMetaRng: (metadata: PanierExpressMetadata) => MetaRngState;
  pickOne: <T>(metadata: PanierExpressMetadata, items: T[]) => PickOneResult<T>;
  formatCourseLabel: (card: string) => string;
  courseItems: () => string[];
  withPending: (
    state: GameStateEntity,
    pending: PendingStateLike,
  ) => GameStateEntity;
}): GameStateEntity {
  const ensured = input.ensureMetadata(input.state);
  const meta = input.getMetadata(ensured);
  let drawn = input.drawFromPool(meta, 'events');
  let metadata = drawn.metadata;
  if (!drawn.card) {
    drawn = input.drawFromPool(
      { ...meta, decks: input.refillEventDeck(meta) },
      'events',
    );
    metadata = drawn.metadata;
    if (!drawn.card) {
      return input.state;
    }
  }

  const event = drawn.card;
  let next: GameStateEntity = { ...ensured, metadata };
  const eventLabel = input.formatEventLabel(event);
  next = input.appendLog(
    next,
    `[Panier Express] Carte Événement: ${eventLabel || event}.`,
  );

  const setPickPending = (params: {
    label: string;
    kind: string;
    choices: string[];
    data?: Record<string, unknown>;
  }): GameStateEntity =>
    setPanierExpressPickPending({
      state: next,
      playerId: input.playerId,
      label: params.label,
      kind: params.kind,
      choices: params.choices,
      data: params.data,
    });

  const ensureDiscardCourses = (): string[] =>
    getPanierExpressDiscardCourses(next, (value) => input.getMetadata(value));

  const addToDiscard = (card: string): void => {
    next = addPanierExpressCourseToDiscard({
      state: next,
      card,
      getMetadata: (value) => input.getMetadata(value),
    });
  };

  const removeOneCourseFromPlayer = (
    pid: number,
    card: string,
  ): { updated: boolean } => {
    const result = removePanierExpressCourseFromPlayer({
      state: next,
      playerId: pid,
      card,
      toStringArray: (value) => input.toStringArray(value),
      removeOne: (items, value) => {
        const list = [...items];
        const index = list.indexOf(value);
        if (index >= 0) list.splice(index, 1);
        return list;
      },
    });
    next = result.state;
    return { updated: result.updated };
  };

  const addOneCourseToPlayer = (pid: number, card: string): void => {
    next = addPanierExpressCourseToPlayer({
      state: next,
      playerId: pid,
      card,
      getMetadata: (value) => input.getMetadata(value),
      toStringArray: (value) => input.toStringArray(value),
      removeOne: (items, value) => {
        const list = [...items];
        const index = list.indexOf(value);
        if (index >= 0) list.splice(index, 1);
        return list;
      },
    });
  };

  const discardRandomCourse = (pid: number): string | null => {
    const result = discardPanierExpressRandomCourse({
      state: next,
      playerId: pid,
      getMetadata: (value) => input.getMetadata(value),
      createMetaRng: (metadata) => input.createMetaRng(metadata),
      pickOne: (metadata, items) => input.pickOne(metadata, items),
      toStringArray: (value) => input.toStringArray(value),
      removeOne: (items, value) => {
        const list = [...items];
        const index = list.indexOf(value);
        if (index >= 0) list.splice(index, 1);
        return list;
      },
    });
    next = result.state;
    return result.discarded;
  };

  const buildTargets = (excludePlayerId: number) =>
    buildPanierExpressEventTargets(next.players ?? [], excludePlayerId);
  const buildTargetChoices = (
    targets: Array<{ playerId: number; username?: string | null }>,
  ) => buildPanierExpressEventTargetChoices(targets);

  const basicEventApplied = applyBasicPanierExpressEvent({
    event,
    eventLabel,
    state: input.state,
    next,
    playerId: input.playerId,
    setPickPending,
    buildTargets,
    buildTargetChoices,
    getPlayers: (value) => input.getPlayers(value),
    toStringArray: (value) => input.toStringArray(value),
    appendLog: (value, message) => input.appendLog(value, message),
    appendActionLog: (value, currentPlayerId, type, payload) =>
      input.appendActionLog(value, currentPlayerId, type, payload),
    playerName: (value, currentPlayerId) =>
      input.playerName(value, currentPlayerId),
    queueCourseDraws: (value, tasks, label) =>
      input.queueCourseDraws(value, tasks, label),
    applyMoveDelta: (value, currentPlayerId, delta) =>
      input.applyMoveDelta(value, currentPlayerId, delta),
    startDrawPending: (value, currentPlayerId, data, label) =>
      input.startDrawPending(value, currentPlayerId, data, label),
    setTurnStatus: (value, currentPlayerId, key, amount) =>
      input.setTurnStatus(value, currentPlayerId, key, amount),
    getMetadata: (value) => input.getMetadata(value),
    movePlayer: (value, currentPlayerId, delta) =>
      input.movePlayer(value, currentPlayerId, delta),
    resolveTile: (value, currentPlayerId) =>
      input.resolveTile(value, currentPlayerId),
    moveCircular: (length, currentPosition, delta) =>
      input.moveCircular(length, currentPosition, delta),
  });
  if (basicEventApplied) {
    return basicEventApplied;
  }

  const addToDiscardState = (current: GameStateEntity, card: string) => {
    next = current;
    addToDiscard(card);
    return next;
  };
  const addOneCourseToPlayerState = (
    current: GameStateEntity,
    currentPlayerId: number,
    card: string,
  ) => {
    next = current;
    addOneCourseToPlayer(currentPlayerId, card);
    return next;
  };
  const discardRandomCourseState = (
    current: GameStateEntity,
    currentPlayerId: number,
  ) => {
    next = current;
    const discarded = discardRandomCourse(currentPlayerId);
    return { state: next, discarded };
  };
  const removeOneCourseFromPlayerState = (
    current: GameStateEntity,
    currentPlayerId: number,
    card: string,
  ) => {
    next = current;
    const result = removeOneCourseFromPlayer(currentPlayerId, card);
    return { state: next, updated: result.updated };
  };

  const advancedEventApplied = applyAdvancedPanierExpressEvent({
    event,
    eventLabel,
    state: input.state,
    next,
    playerId: input.playerId,
    getPlayers: (value) => input.getPlayers(value),
    toStringArray: (value) => input.toStringArray(value),
    appendLog: (value, message) => input.appendLog(value, message),
    appendActionLog: (value, currentPlayerId, type, payload) =>
      input.appendActionLog(value, currentPlayerId, type, payload),
    playerName: (value, currentPlayerId) =>
      input.playerName(value, currentPlayerId),
    queueCourseDraws: (value, tasks, label) =>
      input.queueCourseDraws(value, tasks, label),
    getMetadata: (value) => input.getMetadata(value),
    createMetaRng: (metadata) => input.createMetaRng(metadata),
    pickOne: (metadata, items) => input.pickOne(metadata, items),
    moveCircular: (length, currentPosition, delta) =>
      input.moveCircular(length, currentPosition, delta),
    movePlayer: (value, currentPlayerId, delta) =>
      input.movePlayer(value, currentPlayerId, delta),
    resolveTile: (value, currentPlayerId) =>
      input.resolveTile(value, currentPlayerId),
    setTurnStatus: (value, currentPlayerId, key, amount) =>
      input.setTurnStatus(value, currentPlayerId, key, amount),
    formatCourseLabel: (card) => input.formatCourseLabel(card),
    courseItems: () => input.courseItems(),
    setPickPending,
    withPending: (value, pendingState) =>
      input.withPending(value, pendingState),
    addOneCourseToPlayer: addOneCourseToPlayerState,
    addToDiscard: addToDiscardState,
    ensureDiscardCourses: (value) => {
      next = value;
      return ensureDiscardCourses();
    },
    discardRandomCourse: discardRandomCourseState,
    removeOneCourseFromPlayer: removeOneCourseFromPlayerState,
  });
  if (advancedEventApplied) {
    return advancedEventApplied;
  }

  next = input.appendLog(
    next,
    `[Panier Express] ${eventLabel} : aucun effet (best-effort).`,
  );
  next = input.appendActionLog(next, input.playerId, 'event', {
    event,
    effect: 'none',
  });
  return next;
}
