import { GameStateEntity } from '../../../application/models/game-state.model';
import { PanierExpressMetadata } from './model/panier-express-state.model';
import {
  asRecord,
  toText,
  toUnknownArray,
} from './panier-express-state.helpers';

function buildCourseSets(stands: Record<string, unknown>): {
  fruit: Set<string>;
  veg: Set<string>;
  summerFruit: Set<string>;
  winterVeg: Set<string>;
} {
  const summerFruitStandIds = new Set<string>([
    'fruitier',
    'bio-fruits',
    'fruits-exotiques',
    'fruits-rouges',
  ]);
  const winterVegStandIds = new Set<string>(['primeur-hivernal']);
  const fruitStand = (id: string) =>
    id.includes('fruit') || id === 'agrumes' || id === 'maraicher-automne';
  const fruit = new Set<string>();
  const veg = new Set<string>();
  const summerFruit = new Set<string>();
  const winterVeg = new Set<string>();

  Object.entries(stands).forEach(([id, items]) => {
    const list = Array.isArray(items)
      ? items.map((value) => String(value))
      : [];
    if (id === 'bonus') return;
    if (fruitStand(id)) {
      list.forEach((course) => fruit.add(course));
      if (summerFruitStandIds.has(id)) {
        list.forEach((course) => summerFruit.add(course));
      }
      return;
    }
    list.forEach((course) => veg.add(course));
    if (winterVegStandIds.has(id)) {
      list.forEach((course) => winterVeg.add(course));
    }
  });

  return { fruit, veg, summerFruit, winterVeg };
}

export function resolvePanierExpressExchangePickChoice(args: {
  kind: string;
  state: GameStateEntity;
  actorId: number;
  index: number;
  choices: string[];
  pendingData: Record<string, unknown>;
  clearPending: (state: GameStateEntity) => GameStateEntity;
  standCourseCatalog: () => Record<string, unknown>;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  getPlayers: (state: GameStateEntity) => Array<{
    id: number;
    inventory?: unknown;
  }>;
  toStringArray: (value: unknown) => string[];
  playerName: (state: GameStateEntity, playerId: number) => string;
  formatCourseLabel: (card: string) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  addCourseToPlayer: (
    state: GameStateEntity,
    playerId: number,
    card: string,
  ) => GameStateEntity;
  discardCourse: (
    state: GameStateEntity,
    playerId: number,
    card: string,
  ) => GameStateEntity;
  removeCourseFromPlayer: (
    state: GameStateEntity,
    playerId: number,
    card: string,
  ) => { state: GameStateEntity; removed: boolean };
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | null };
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
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
}): GameStateEntity | null {
  const courseSets = buildCourseSets(args.standCourseCatalog());

  if (args.kind === 'exchange.strategique.choose_target') {
    const exchangeId = args.pendingData.exchangeId ?? null;
    const targets = Array.isArray(args.pendingData.targets)
      ? args.pendingData.targets
      : [];
    const chosenTarget = asRecord(targets[args.index]);
    const targetPlayerId = Number(chosenTarget?.playerId);
    if (!Number.isFinite(targetPlayerId)) return args.clearPending(args.state);
    const target = args
      .getPlayers(args.state)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory);
    if (!targetInv.length) {
      let next = args.clearPending(args.state);
      next = args.appendLog(
        next,
        `[Panier Express] Échange stratégique : cible sans inventaire.`,
      );
      return args.advanceTurn(next);
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label:
          'Choisissez la carte à recevoir (inventaire adverse), puis Entrée.',
        choices: targetInv,
        data: {
          kind: 'exchange.strategique.choose_take',
          exchangeId,
          targetPlayerId,
          takeChoices: targetInv,
        },
      },
    };
  }

  if (args.kind === 'exchange.strategique.choose_take') {
    const exchangeId = args.pendingData.exchangeId ?? null;
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const takeChoices = Array.isArray(args.pendingData.takeChoices)
      ? args.pendingData.takeChoices.map((value) => String(value))
      : [];
    const take = toText(takeChoices[args.index]).trim();
    if (!Number.isFinite(targetPlayerId) || !take) {
      return args.clearPending(args.state);
    }
    const me = args
      .getPlayers(args.state)
      .find((player) => player.id === args.actorId);
    const myInv = args.toStringArray(me?.inventory);
    if (!myInv.length) return args.clearPending(args.state);
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label: 'Choisissez la carte à offrir (inventaire), puis Entrée.',
        choices: myInv,
        data: {
          kind: 'exchange.strategique.choose_give',
          exchangeId,
          targetPlayerId,
          take,
        },
      },
    };
  }

  if (args.kind === 'exchange.strategique.choose_give') {
    const exchangeId = args.pendingData.exchangeId ?? null;
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const take = toText(args.pendingData.take).trim();
    const give = toText(args.choices[args.index]).trim();
    if (!Number.isFinite(targetPlayerId) || !take || !give) {
      return args.clearPending(args.state);
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: targetPlayerId,
        blocking: true,
        label: `Échange stratégique : ${args.playerName(args.state, args.actorId)} vous propose "${args.formatCourseLabel(give)}" contre "${args.formatCourseLabel(take)}". Choisissez Accepter ou Refuser.`,
        choices: ['Accepter', 'Refuser'],
        data: {
          kind: 'exchange.strategique.confirm',
          exchangeId,
          initiatorId: args.actorId,
          targetPlayerId,
          give,
          take,
        },
      },
    };
  }

  if (args.kind === 'exchange.strategique.confirm') {
    const initiatorId = Number(args.pendingData.initiatorId);
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const give = toText(args.pendingData.give).trim();
    const take = toText(args.pendingData.take).trim();
    const exchangeId = args.pendingData.exchangeId ?? null;
    if (
      !Number.isFinite(initiatorId) ||
      !Number.isFinite(targetPlayerId) ||
      !give ||
      !take
    ) {
      return args.clearPending(args.state);
    }

    const meta = args.getMetadata(args.state);
    const alreadyResolved = Array.isArray(meta.actionLog)
      ? meta.actionLog.some(
          (entry) =>
            entry?.type === 'exchange' &&
            asRecord(entry.payload).kind === 'exchange.strategique.confirm' &&
            exchangeId != null &&
            asRecord(entry.payload).exchangeId === exchangeId,
        )
      : false;
    if (alreadyResolved) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const accepted = args.index === 0;
    next = args.appendActionLog(next, args.actorId, 'exchange', {
      kind: 'exchange.strategique.confirm',
      exchangeId,
      initiatorId,
      targetPlayerId,
      accepted,
      give,
      take,
    });
    if (accepted) {
      const removedGive = args.removeCourseFromPlayer(next, initiatorId, give);
      next = removedGive.state;
      const removedTake = args.removeCourseFromPlayer(next, args.actorId, take);
      next = removedTake.state;
      if (removedGive.removed) {
        next = args.addCourseToPlayer(next, args.actorId, give);
      }
      if (removedTake.removed) {
        next = args.addCourseToPlayer(next, initiatorId, take);
      }
      next = args.appendLog(
        next,
        `[Panier Express] Échange stratégique : ${args.playerName(args.state, initiatorId)} donne "${args.formatCourseLabel(give)}" à ${args.playerName(args.state, args.actorId)} et reçoit "${args.formatCourseLabel(take)}" en échange.`,
      );
    } else {
      next = args.appendLog(
        next,
        `[Panier Express] Échange stratégique : ${args.playerName(args.state, args.actorId)} refuse l'échange proposé par ${args.playerName(args.state, initiatorId)}.`,
      );
    }
    return args.advanceTurn(next);
  }

  if (args.kind === 'exchange.troc_fruit_legume.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosenTarget = targets[args.index];
    const targetPlayerId = Number(chosenTarget.playerId);
    if (!Number.isFinite(targetPlayerId)) return args.clearPending(args.state);
    const me = args
      .getPlayers(args.state)
      .find((player) => player.id === args.actorId);
    const myInv = args.toStringArray(me?.inventory ?? []);
    const fruitCards = myInv.filter((card) => courseSets.fruit.has(card));
    if (!fruitCards.length) {
      let next = args.clearPending(args.state);
      next = args.appendLog(
        next,
        `[Panier Express] Troquez un fruit contre un légume : aucun fruit.`,
      );
      return args.advanceTurn(next);
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label: 'Choisissez le fruit à donner, puis Entrée.',
        choices: fruitCards,
        data: {
          kind: 'exchange.troc_fruit_legume.choose_give',
          targetPlayerId,
        },
      },
    };
  }

  if (args.kind === 'exchange.troc_fruit_legume.choose_give') {
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const give = toText(args.choices[args.index]).trim();
    if (!Number.isFinite(targetPlayerId) || !give) {
      return args.clearPending(args.state);
    }
    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory ?? []);
    const vegCards = targetInv.filter((card) => courseSets.veg.has(card));
    if (!vegCards.length) {
      next = args.appendLog(
        next,
        `[Panier Express] Troquez un fruit contre un légume : cible sans légume.`,
      );
      return args.advanceTurn(next);
    }
    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), vegCards);
    next = { ...next, metadata: picked.meta };
    const take = toText(picked.value).trim();
    const removedGive = args.removeCourseFromPlayer(next, args.actorId, give);
    next = removedGive.state;
    const removedTake = args.removeCourseFromPlayer(next, targetPlayerId, take);
    next = removedTake.state;
    if (removedGive.removed) {
      next = args.addCourseToPlayer(next, targetPlayerId, give);
    }
    if (removedTake.removed) {
      next = args.addCourseToPlayer(next, args.actorId, take);
    }
    next = args.appendLog(
      next,
      `[Panier Express] Troc fruit/légume : échange effectué.`,
    );
    return args.advanceTurn(next);
  }

  if (args.kind === 'exchange.echange_saison.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosenTarget = targets[args.index];
    const targetPlayerId = Number(chosenTarget.playerId);
    if (!Number.isFinite(targetPlayerId)) return args.clearPending(args.state);
    const me = args
      .getPlayers(args.state)
      .find((player) => player.id === args.actorId);
    const myInv = args.toStringArray(me?.inventory ?? []);
    const fruitCards = myInv.filter((card) => courseSets.summerFruit.has(card));
    if (!fruitCards.length) {
      let next = args.clearPending(args.state);
      next = args.appendLog(
        next,
        `[Panier Express] Échange de saison : aucun fruit d'été, pioche.`,
      );
      return args.queueCourseDraws(
        next,
        [{ playerId: args.actorId, standId: 'bonus' }],
        'Piocher une course bonus (Espace).',
      );
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label: "Choisissez le fruit d'été à donner, puis Entrée.",
        choices: fruitCards,
        data: {
          kind: 'exchange.echange_saison.choose_give',
          targetPlayerId,
        },
      },
    };
  }

  if (args.kind === 'exchange.echange_saison.choose_give') {
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const give = toText(args.choices[args.index]).trim();
    if (!Number.isFinite(targetPlayerId) || !give) {
      return args.clearPending(args.state);
    }
    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory ?? []);
    const winterVegCards = targetInv.filter((card) =>
      courseSets.winterVeg.has(card),
    );
    if (!winterVegCards.length) {
      next = args.appendLog(
        next,
        `[Panier Express] Échange de saison : cible sans légume d'hiver.`,
      );
      return args.advanceTurn(next);
    }
    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), winterVegCards);
    next = { ...next, metadata: picked.meta };
    const take = toText(picked.value).trim();
    const removedGive = args.removeCourseFromPlayer(next, args.actorId, give);
    next = removedGive.state;
    const removedTake = args.removeCourseFromPlayer(next, targetPlayerId, take);
    next = removedTake.state;
    if (removedGive.removed) {
      next = args.addCourseToPlayer(next, targetPlayerId, give);
    }
    if (removedTake.removed) {
      next = args.addCourseToPlayer(next, args.actorId, take);
    }
    next = args.appendLog(
      next,
      `[Panier Express] Échange de saison : échange effectué.`,
    );
    return args.advanceTurn(next);
  }

  if (args.kind === 'exchange.marche_noir.discard') {
    const chosen = toText(args.choices[args.index]).trim();
    let next = args.clearPending(args.state);
    if (chosen) {
      next = args.discardCourse(next, args.actorId, chosen);
    }
    next = args.appendLog(
      next,
      `[Panier Express] Marché noir : défausse puis pioche un quiz.`,
    );
    next = args.appendActionLog(next, args.actorId, 'exchange', {
      card: 'marche-noir',
      discarded: chosen,
    });
    return args.applyQuiz(next, args.actorId);
  }

  if (args.kind === 'exchange.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosen = targets[args.index];
    const targetPlayerId = Number(chosen.playerId);
    const card = toText(args.pendingData.card).trim();
    if (!Number.isFinite(targetPlayerId)) return args.clearPending(args.state);
    const next = args.clearPending(args.state);
    return args.applyExchangeCard(next, args.actorId, targetPlayerId, card);
  }

  if (args.kind === 'exchange.impose.choose_card') {
    const initiatorId = Number(args.pendingData.initiatorId);
    const cards = Array.isArray(args.pendingData.cards)
      ? args.pendingData.cards.map((value) => String(value))
      : [];
    const give = cards[args.index] ?? '';
    if (!Number.isFinite(initiatorId) || !give) {
      return args.clearPending(args.state);
    }
    let next = args.clearPending(args.state);
    const removed = args.removeCourseFromPlayer(next, args.actorId, give);
    next = removed.state;
    if (removed.removed) {
      next = args.addCourseToPlayer(next, initiatorId, give);
    }
    next = args.appendLog(
      next,
      `[Panier Express] Échange imposé : ${args.playerName(args.state, args.actorId)} donne "${args.formatCourseLabel(give)}" à ${args.playerName(args.state, initiatorId)}.`,
    );
    return args.advanceTurn(next);
  }

  return null;
}




