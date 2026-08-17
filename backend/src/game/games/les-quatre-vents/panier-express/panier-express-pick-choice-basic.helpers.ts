import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { PanierExpressMetadata } from './model/panier-express-state.entity';
import {
  asRecord,
  stringEqualsInsensitive,
  toText,
  toUnknownArray,
} from './panier-express-state.helpers';

export function resolveBasicPanierExpressPickChoice(args: {
  kind: string;
  state: GameStateEntity;
  actorId: number;
  index: number;
  choices: string[];
  pendingData: Record<string, unknown>;
  clearPending: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  asStringDeckPool: (
    pool: PanierExpressMetadata['decks'],
  ) => PanierExpressMetadata['decks'];
  discardMany: (
    pool: PanierExpressMetadata['decks'],
    deckKey: string,
    cards: string[],
  ) => PanierExpressMetadata['decks'];
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
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  formatCourseLabel: (card: string) => string;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
  getPlayers: (state: GameStateEntity) => Array<{
    id: number;
    username?: string | null;
    inventory?: unknown;
  }>;
  toStringArray: (value: unknown) => string[];
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | undefined };
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
}): GameStateEntity | null {
  if (args.kind === 'event.tirage_chanceux') {
    const offered: string[] = Array.isArray(args.pendingData.offered)
      ? args.pendingData.offered.map((value) => String(value))
      : Array.isArray(args.pendingData.cards)
        ? args.pendingData.cards.map((value) => String(value))
        : [];
    const uniqueOffered = Array.from(new Set(offered));
    const chosen = uniqueOffered[args.index] ?? '';
    let next = args.clearPending(args.state);

    const unchosen = uniqueOffered.filter((_, idx) => idx !== args.index);
    if (unchosen.length) {
      const metadata = args.getMetadata(next);
      next = {
        ...next,
        metadata: {
          ...metadata,
          decks: args.asStringDeckPool(
            args.discardMany(
              args.asStringDeckPool(metadata.decks),
              'courses-bonus',
              unchosen,
            ),
          ),
        },
      };
    }

    next = args.addCourseToPlayer(next, args.actorId, chosen);
    next = args.appendLog(
      next,
      `[Panier Express] Tirage chanceux : ${args.playerName(args.state, args.actorId)} choisit "${args.formatCourseLabel(chosen)}".`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      event: 'tirage-chanceux',
      choice: chosen,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.discard') {
    const cards = Array.isArray(args.pendingData.cards)
      ? args.pendingData.cards.map((value) => String(value))
      : [];
    const chosen = cards[args.index] ?? '';
    let next = args.clearPending(args.state);
    next = args.discardCourse(next, args.actorId, chosen);
    next = args.appendLog(
      next,
      `[Panier Express] ${args.playerName(args.state, args.actorId)} defausse "${chosen}".`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      effect: 'discard',
      card: chosen,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.producteur_genereux.choose_card') {
    const cards = Array.isArray(args.pendingData.cards)
      ? args.pendingData.cards.map((value) => String(value))
      : [];
    const chosen = cards[args.index] ?? '';
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const choices = targets
      .map((target) => toText(target.username))
      .filter((value: string) => value.length > 0);
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label: 'Choisissez un joueur pour recevoir la carte.',
        choices,
        data: {
          kind: 'event.producteur_genereux.choose_target',
          give: chosen,
          offerFromInventory: true,
          targets,
        },
      },
    };
  }

  if (args.kind === 'event.producteur_genereux.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosenTarget = targets[args.index];
    const targetPlayerId = Number(chosenTarget.playerId);
    const offer = toText(args.pendingData.offer).trim();
    const give = toText(args.pendingData.give).trim();
    const card = offer || give;
    const offerFromInventory = Boolean(args.pendingData.offerFromInventory);
    if (!Number.isFinite(targetPlayerId) || !card) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    if (offerFromInventory || give) {
      const removed = args.removeCourseFromPlayer(next, args.actorId, card);
      next = removed.state;
    }
    next = args.addCourseToPlayer(next, targetPlayerId, card);
    next = args.appendLog(
      next,
      `[Panier Express] Producteur genereux : ${args.playerName(args.state, args.actorId)} pioche 2 cartes et offre "${args.formatCourseLabel(card)}" a ${args.playerName(args.state, targetPlayerId)}.`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      event: 'producteur-genereux',
      give: card,
      targetPlayerId,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.panier_bonus.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosenTarget = targets[args.index];
    const targetPlayerId = Number(chosenTarget.playerId);
    if (!Number.isFinite(targetPlayerId)) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const cards = args.toStringArray(target?.inventory ?? []);
    if (!cards.length) {
      next = args.appendLog(
        next,
        `[Panier Express] Panier bonus : ${args.playerName(args.state, targetPlayerId)} n'a aucune carte.`,
      );
      return args.advanceTurn(next);
    }

    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), cards);
    next = { ...next, metadata: picked.meta };
    const stolen = String(picked.value ?? '').trim();
    if (stolen) {
      const removed = args.removeCourseFromPlayer(next, targetPlayerId, stolen);
      next = removed.state;
      if (removed.removed) {
        next = args.addCourseToPlayer(next, args.actorId, stolen);
      }
    }
    next = args.appendLog(
      next,
      `[Panier Express] Panier bonus : ${args.playerName(args.state, args.actorId)} prend "${args.formatCourseLabel(stolen)}" a ${args.playerName(args.state, targetPlayerId)}.`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      event: 'panier-bonus',
      targetPlayerId,
      card: stolen,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.echange_spontane.choose_target') {
    const targets = toUnknownArray(args.pendingData.targets).map((item) =>
      asRecord(item),
    );
    const chosenTarget = targets[args.index];
    const targetPlayerId = Number(chosenTarget.playerId);
    if (!Number.isFinite(targetPlayerId)) {
      return args.clearPending(args.state);
    }
    const me = args
      .getPlayers(args.state)
      .find((player) => player.id === args.actorId);
    const inventory = args.toStringArray(me?.inventory ?? []);
    if (!inventory.length) {
      return args.clearPending(args.state);
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.actorId,
        blocking: true,
        label: 'Choisissez la carte a donner (inventaire), puis Entree.',
        choices: inventory,
        data: {
          kind: 'event.echange_spontane.choose_give',
          targetPlayerId,
        },
      },
    };
  }

  if (args.kind === 'event.echange_spontane.choose_give') {
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) {
      return args.clearPending(args.state);
    }
    const give = toText(args.choices[args.index]).trim();
    if (!give) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory ?? []);
    if (!targetInv.length) {
      next = args.appendLog(
        next,
        `[Panier Express] Echange spontane : ${args.playerName(args.state, targetPlayerId)} n'a aucune carte.`,
      );
      return args.advanceTurn(next);
    }
    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), targetInv);
    next = { ...next, metadata: picked.meta };
    const take = String(picked.value ?? '').trim();
    if (!take) {
      return args.advanceTurn(next);
    }

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
      `[Panier Express] Echange spontane : ${args.playerName(args.state, args.actorId)} donne "${args.formatCourseLabel(give)}" a ${args.playerName(args.state, targetPlayerId)} et recoit "${args.formatCourseLabel(take)}" de ${args.playerName(args.state, targetPlayerId)}.`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      event: 'echange-spontane',
      give,
      take,
      targetPlayerId,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.conseil_voisinage.pick') {
    const candidates = toUnknownArray(args.pendingData.candidates).map((item) =>
      asRecord(item),
    );
    const chosen = candidates[args.index];
    const targetPlayerId = Number(chosen.targetPlayerId);
    const card = toText(chosen.card).trim();
    if (!Number.isFinite(targetPlayerId) || !card) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const removed = args.removeCourseFromPlayer(next, targetPlayerId, card);
    next = removed.state;
    if (removed.removed) {
      next = args.addCourseToPlayer(next, args.actorId, card);
    }

    const me = args
      .getPlayers(next)
      .find((player) => player.id === args.actorId);
    const myInv = args.toStringArray(me?.inventory ?? []);
    if (myInv.length) {
      const metaRng = args.createMetaRng(args.getMetadata(next));
      const picked = args.pickOne(metaRng.getMeta(), myInv);
      next = { ...next, metadata: picked.meta };
      const give = toText(picked.value).trim();
      if (give) {
        const removedGive = args.removeCourseFromPlayer(
          next,
          args.actorId,
          give,
        );
        next = removedGive.state;
        if (removedGive.removed) {
          next = args.addCourseToPlayer(next, targetPlayerId, give);
        }
      }
    }

    next = args.appendLog(
      next,
      `[Panier Express] Conseil de voisinage : ${args.playerName(args.state, args.actorId)} prend "${args.formatCourseLabel(card)}" a ${args.playerName(args.state, targetPlayerId)}.`,
    );
    next = args.appendActionLog(next, args.actorId, 'event', {
      event: 'conseil-de-voisinage',
      card,
      targetPlayerId,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.troc_improvise') {
    const order = Array.isArray(args.pendingData.order)
      ? args.pendingData.order.map((value) => Number(value))
      : [];
    const cursor = Number(args.pendingData.cursor);
    const processed = Number(args.pendingData.processed);
    const give = toText(args.choices[args.index]).trim();
    if (
      !order.length ||
      !Number.isFinite(cursor) ||
      !Number.isFinite(processed) ||
      !give
    ) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const giverIndex = Math.max(0, Math.min(order.length - 1, cursor));
    const giverId = Number(order[giverIndex]);
    const receiverId = Number(order[(giverIndex + 1) % order.length]);

    const removed = args.removeCourseFromPlayer(next, giverId, give);
    next = removed.state;
    if (removed.removed) {
      next = args.addCourseToPlayer(next, receiverId, give);
    }
    next = args.appendLog(
      next,
      `[Panier Express] Troc improvise : ${args.playerName(args.state, giverId)} donne "${args.formatCourseLabel(give)}" a ${args.playerName(args.state, receiverId)}.`,
    );

    let nextCursor = (giverIndex + 1) % order.length;
    let nextProcessed = processed + 1;
    while (nextProcessed < order.length) {
      const pid = Number(order[nextCursor]);
      const player = args.getPlayers(next).find((entry) => entry.id === pid);
      const inventory = args.toStringArray(player?.inventory ?? []);
      if (inventory.length) {
        return {
          ...next,
          pending: {
            type: 'pick',
            playerId: pid,
            blocking: true,
            label:
              'Choisissez une carte a donner au joueur suivant, puis Entree.',
            choices: inventory,
            data: {
              kind: 'event.troc_improvise',
              order,
              cursor: nextCursor,
              processed: nextProcessed,
            },
          },
        };
      }
      nextCursor = (nextCursor + 1) % order.length;
      nextProcessed += 1;
    }

    next = args.appendLog(next, `[Panier Express] Troc improvise : termine.`);
    return args.advanceTurn(next);
  }

  if (args.kind === 'event.changement_de_saison') {
    const order = Array.isArray(args.pendingData.order)
      ? args.pendingData.order.map((value) => Number(value))
      : [];
    const cursor = Number(args.pendingData.cursor);
    const processed = Number(args.pendingData.processed);
    const chosen = String(args.choices[args.index] ?? '').trim();
    if (
      !order.length ||
      !Number.isFinite(cursor) ||
      !Number.isFinite(processed)
    ) {
      return args.clearPending(args.state);
    }

    let next = args.clearPending(args.state);
    const currentIndex = Math.max(0, Math.min(order.length - 1, cursor));
    const pid = Number(order[currentIndex]);
    if (chosen) {
      next = args.discardCourse(next, pid, chosen);
    }
    return {
      ...next,
      pending: {
        type: 'draw',
        playerId: pid,
        blocking: true,
        label: 'Piocher une course bonus (Espace).',
        data: {
          kind: 'event.changement_de_saison',
          order,
          cursor: currentIndex,
          processed,
        },
      },
    };
  }

  if (args.kind === 'tile.move_to_stand_choice') {
    const targets: unknown[] = Array.isArray(args.pendingData.targets)
      ? (args.pendingData.targets as unknown[])
      : [];
    const target = asRecord(targets[args.index]);
    if (!targets[args.index] || !Number.isFinite(Number(target.position))) {
      return args.clearPending(args.state);
    }
    const ensured = args.ensureMetadata(args.state);
    const metadata = args.getMetadata(ensured);
    const tiles =
      Array.isArray(metadata.tiles) && metadata.tiles.length
        ? metadata.tiles
        : args.buildTiles();
    if (!tiles.length) {
      return args.clearPending(args.state);
    }

    const currentPos = metadata.positions[args.actorId] ?? 0;
    const total = tiles.length;
    const targetPos = Math.max(
      0,
      Math.min(total - 1, Math.floor(Number(target.position))),
    );
    const delta = (((targetPos - currentPos) % total) + total) % total;
    if (delta === 0) {
      let next = args.clearPending(args.state);
      next = args.appendLog(
        next,
        `[Panier Express] ${args.playerName(args.state, args.actorId)} reste sur place (stand deja atteint).`,
      );
      return args.advanceAfterDraw(next);
    }
    let next = args.clearPending(args.state);
    next = args.appendLog(
      next,
      `[Panier Express] ${args.playerName(args.state, args.actorId)} choisit de rejoindre ${toText(target.label)} (case ${Number(target.caseNumber)}).`,
    );
    next = args.movePlayer(next, args.actorId, delta);
    next = args.resolveTile(next, args.actorId);
    next = args.appendActionLog(next, args.actorId, 'tile', {
      tile: 'move_to_stand_choice',
      standId: toText(target.standId) || undefined,
      caseNumber: Number(target.caseNumber),
    });
    return args.advanceAfterDraw(next);
  }

  if (args.kind === 'tile.move_choice') {
    const delta = Math.max(1, Math.abs(Number(args.pendingData.delta ?? 2)));
    const signed = args.index === 0 ? delta : -delta;
    let next = args.clearPending(args.state);
    next = args.applyMoveDelta(next, args.actorId, signed);
    next = args.appendActionLog(next, args.actorId, 'tile', {
      tile: 'move_choice',
      delta: signed,
    });
    return args.advanceTurn(next);
  }

  if (args.kind === 'merchant_request.choose') {
    const ingredient = toText(args.pendingData.ingredient).trim();
    const chosen = toText(args.choices[args.index]).trim();
    if (!ingredient || !chosen) {
      return args.clearPending(args.state);
    }
    if (stringEqualsInsensitive(chosen, 'Refuser')) {
      return args.handleMerchantRequestRefuse(args.state);
    }
    if (!stringEqualsInsensitive(chosen, ingredient)) {
      return args.appendLog(
        args.state,
        `[Panier Express] Le marchand souhaite "${args.formatCourseLabel(ingredient)}". Choisissez l'ingredient demande ou "Refuser".`,
      );
    }
    return args.handleMerchantRequestAccept(args.state);
  }

  if (args.kind === 'exchange.troc_rapide.choose_give') {
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) {
      return args.clearPending(args.state);
    }
    const give = toText(args.choices[args.index]).trim();
    if (!give) {
      return args.clearPending(args.state);
    }
    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory);
    if (!targetInv.length) {
      next = args.appendLog(
        next,
        `[Panier Express] Troc rapide : cible sans inventaire.`,
      );
      return args.advanceTurn(next);
    }
    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), targetInv);
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
      `[Panier Express] Troc rapide : ${args.playerName(args.state, args.actorId)} donne "${args.formatCourseLabel(give)}" et recoit "${args.formatCourseLabel(take)}".`,
    );
    return args.advanceTurn(next);
  }

  if (args.kind === 'exchange.voisin.choose_give') {
    const targetPlayerId = Number(args.pendingData.targetPlayerId);
    const exchangeLabel =
      toText(args.pendingData.exchangeLabel).trim() || 'Echange';
    if (!Number.isFinite(targetPlayerId)) {
      return args.clearPending(args.state);
    }
    const give = toText(args.choices[args.index]).trim();
    if (!give) {
      return args.clearPending(args.state);
    }
    let next = args.clearPending(args.state);
    const target = args
      .getPlayers(next)
      .find((player) => player.id === targetPlayerId);
    const targetInv = args.toStringArray(target?.inventory);
    if (!targetInv.length) {
      next = args.appendLog(
        next,
        `[Panier Express] ${exchangeLabel} : cible sans inventaire.`,
      );
      return args.advanceTurn(next);
    }
    const metaRng = args.createMetaRng(args.getMetadata(next));
    const picked = args.pickOne(metaRng.getMeta(), targetInv);
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
      `[Panier Express] ${exchangeLabel} : ${args.playerName(args.state, args.actorId)} donne "${args.formatCourseLabel(give)}" a ${args.playerName(args.state, targetPlayerId)} et recoit "${args.formatCourseLabel(take)}".`,
    );
    return args.advanceTurn(next);
  }

  return null;
}
