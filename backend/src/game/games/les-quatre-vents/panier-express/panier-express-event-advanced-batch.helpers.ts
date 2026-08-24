import { GameStateEntity } from '../../../application/models/game-state.model';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from './model/panier-express-state.model';
import { toText } from './panier-express-state.helpers';

export function applyAdvancedPanierExpressEventBatch(args: {
  event: string;
  eventLabel: string;
  state: GameStateEntity;
  next: GameStateEntity;
  playerId: number;
  getPlayers: (state: GameStateEntity) => PanierExpressPlayer[];
  toStringArray: (value: unknown) => string[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  createMetaRng: (metadata: PanierExpressMetadata) => {
    getMeta: () => PanierExpressMetadata;
  };
  pickOne: <T>(
    metadata: PanierExpressMetadata,
    items: T[],
  ) => { meta: PanierExpressMetadata; value: T | null };
  moveCircular: (
    length: number,
    currentPosition: number,
    delta: number,
  ) => number;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
  setTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
    value: number,
  ) => GameStateEntity;
  formatCourseLabel: (card: string) => string;
  courseItems: () => string[];
  setPickPending: (params: {
    label: string;
    kind: string;
    choices: string[];
    data?: Record<string, unknown>;
  }) => GameStateEntity;
  withPending: (
    state: GameStateEntity,
    pending: NonNullable<GameStateEntity['pending']>,
  ) => GameStateEntity;
  addOneCourseToPlayer: (
    state: GameStateEntity,
    playerId: number,
    card: string,
  ) => GameStateEntity;
  ensureDiscardCourses: (state: GameStateEntity) => string[];
  discardRandomCourse: (
    state: GameStateEntity,
    playerId: number,
  ) => { state: GameStateEntity; discarded: string | null };
  removeOneCourseFromPlayer: (
    state: GameStateEntity,
    playerId: number,
    card: string,
  ) => { state: GameStateEntity; updated: boolean };
}): GameStateEntity | null {
  let next = args.next;
  const addEffectLog = (effect: string, payload?: Record<string, unknown>) =>
    args.appendActionLog(next, args.playerId, 'event', {
      event: args.event,
      effect,
      ...payload,
    });

  switch (args.event) {
    case 'produit-oublie': {
      const items = args.courseItems();
      const metaRng = args.createMetaRng(args.getMetadata(next));
      const picked = items.length
        ? args.pickOne(metaRng.getMeta(), items)
        : null;
      next = picked ? { ...next, metadata: picked.meta } : next;
      const added = picked ? String(picked.value ?? '').trim() : null;
      if (!added) return next;
      next = args.addOneCourseToPlayer(next, args.playerId, added);
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel} : recupere "${args.formatCourseLabel(added)}".`,
      );
      return addEffectLog('grant', { card: added });
    }
    case 'offre-ephemere': {
      const discard = args.ensureDiscardCourses(next);
      if (!discard.length) {
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel} : defausse vide.`,
        );
        return addEffectLog('none');
      }
      const metaRng = args.createMetaRng(args.getMetadata(next));
      const picked = args.pickOne(metaRng.getMeta(), discard);
      next = { ...next, metadata: picked.meta };
      const card = String(picked.value ?? '').trim();
      if (!card) return next;
      const remaining = discard.filter((value) => value !== card);
      const metaNow = args.getMetadata(next);
      next = {
        ...next,
        metadata: {
          ...metaNow,
          discards: { ...metaNow.discards, courses: remaining },
        },
      };
      next = args.addOneCourseToPlayer(next, args.playerId, card);
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel} : recupere "${args.formatCourseLabel(card)}".`,
      );
      return addEffectLog('from_discard', { card });
    }
    case 'controle-des-inventaires': {
      let maxId: number | null = null;
      let max = -1;
      args.getPlayers(next).forEach((player) => {
        const inventory = args.toStringArray(player.inventory);
        if (inventory.length > max) {
          max = inventory.length;
          maxId = player.id;
        }
      });
      if (maxId != null && max > 0) {
        const discardedResult = args.discardRandomCourse(next, maxId);
        next = discardedResult.state;
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel} : ${args.playerName(args.state, maxId)} defausse "${args.formatCourseLabel(discardedResult.discarded ?? '')}".`,
        );
        return addEffectLog('max_discard', {
          discarded: discardedResult.discarded,
          targetPlayerId: maxId,
        });
      }
      return addEffectLog('none');
    }
    case 'stand-surprise': {
      const rng = args.pickOne(args.getMetadata(next), [1, 2, 3, 4, 5, 6]);
      next = { ...next, metadata: rng.meta };
      const roll = Number(rng.value ?? 1);
      const matcher =
        roll <= 2
          ? (id: string) => id.startsWith('bio')
          : roll <= 4
            ? (id: string) => id === 'fruitier'
            : (id: string) => id.startsWith('primeur');
      const metaNow = args.getMetadata(next);
      const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
      const total = tiles.length;
      const current = metaNow.positions?.[args.playerId] ?? 0;
      for (let steps = 1; steps < total; steps += 1) {
        const idx = args.moveCircular(total, current, steps);
        const tile = tiles[idx];
        if (tile?.type === 'stand' && matcher(toText(tile.standId))) {
          next = args.movePlayer(next, args.playerId, steps);
          break;
        }
      }
      next = args.resolveTile(next, args.playerId);
      return addEffectLog('move_to_nearest_stand', { roll });
    }
    case 'carton-abime':
      next = args.setTurnStatus(next, args.playerId, 'revealShoppingList', 1);
      next = args.appendLog(
        next,
        `[Panier Express] Carton abime : votre liste est visible (1 tour).`,
      );
      return addEffectLog('reveal_list');
    case 'conseil-de-voisinage': {
      const me = args
        .getPlayers(next)
        .find((player) => player.id === args.playerId);
      const myList = args.toStringArray(me?.shoppingList ?? []);
      const myBasket = args.toStringArray(me?.basket ?? []);
      const myInventory = args.toStringArray(me?.inventory ?? []);
      const missing = new Set(
        myList.filter((item) => !myBasket.includes(item)),
      );
      if (!missing.size) {
        next = args.appendLog(
          next,
          `[Panier Express] Conseil de voisinage : aucun besoin (liste deja complete).`,
        );
        return addEffectLog('none');
      }
      const candidates: Array<{
        targetPlayerId: number;
        card: string;
        label: string;
      }> = [];
      args.getPlayers(next).forEach((player) => {
        if (player.id === args.playerId) return;
        const inventory = args.toStringArray(player.inventory);
        inventory.forEach((card) => {
          if (!missing.has(card)) return;
          candidates.push({
            targetPlayerId: player.id,
            card,
            label: `${String(player.username ?? `Joueur ${player.id}`)}: ${card}`,
          });
        });
      });
      if (!candidates.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Conseil de voisinage : aucun autre joueur n'a de carte utile pour votre liste.`,
        );
        return addEffectLog('none');
      }
      next = args.setPickPending({
        label: 'Choisissez une carte a prendre, puis Entree.',
        kind: 'event.conseil_voisinage.pick',
        choices: candidates.map((candidate) => candidate.label),
        data: { candidates, myInventory },
      });
      return addEffectLog('pick');
    }
    case 'troc-improvise': {
      const order = args
        .getPlayers(next)
        .map((player) => Number(player.id))
        .filter((id) => Number.isFinite(id));
      const start = order.indexOf(args.playerId);
      if (!order.length || start < 0) {
        next = args.appendLog(
          next,
          `[Panier Express] Troc improvise : impossible.`,
        );
        return addEffectLog('none');
      }
      let cursor = start;
      let processed = 0;
      while (processed < order.length) {
        const pid = order[cursor];
        const inventory = args.toStringArray(
          args.getPlayers(next).find((player) => player.id === pid)
            ?.inventory ?? [],
        );
        if (inventory.length) {
          next = args.withPending(next, {
            type: 'pick',
            playerId: pid,
            blocking: true,
            label:
              'Choisissez une carte a donner au joueur suivant, puis Entree.',
            choices: inventory,
            data: { kind: 'event.troc_improvise', order, cursor, processed },
          });
          break;
        }
        cursor = (cursor + 1) % order.length;
        processed += 1;
      }
      if (!next.pending) {
        next = args.appendLog(
          next,
          `[Panier Express] Troc improvise : aucun inventaire a echanger.`,
        );
      }
      return addEffectLog('multi_pick');
    }
    case 'changement-de-saison': {
      const order = args
        .getPlayers(next)
        .map((player) => Number(player.id))
        .filter((id) => Number.isFinite(id));
      const start = order.indexOf(args.playerId);
      if (!order.length || start < 0) {
        next = args.appendLog(
          next,
          `[Panier Express] Changement de saison : impossible.`,
        );
        return addEffectLog('none');
      }
      const pid = order[start];
      const player = args.getPlayers(next).find((entry) => entry.id === pid);
      const cards = args.toStringArray(player?.inventory);
      next = cards.length
        ? {
            ...next,
            pending: {
              type: 'pick',
              playerId: pid,
              blocking: true,
              label: 'Choisissez une carte a defausser, puis Entree.',
              choices: cards,
              data: {
                kind: 'event.changement_de_saison',
                order,
                cursor: start,
                processed: 0,
                cards,
              },
            },
          }
        : {
            ...next,
            pending: {
              type: 'draw',
              playerId: pid,
              blocking: true,
              label: 'Piocher une course bonus (Espace).',
              data: {
                kind: 'event.changement_de_saison',
                order,
                cursor: start,
                processed: 0,
              },
            },
          };
      return addEffectLog('multi_pick');
    }
    case 'echange-obligatoire': {
      const players = args.getPlayers(next);
      const idx = players.findIndex((player) => player.id === args.playerId);
      if (idx < 0 || players.length < 2) {
        next = args.appendLog(
          next,
          `[Panier Express] Echange obligatoire : aucun echange possible.`,
        );
        return addEffectLog('none');
      }
      const targetId = Number(players[(idx + 1) % players.length]?.id);
      const me = players.find((player) => player.id === args.playerId);
      const target = players.find((player) => player.id === targetId);
      const myInventory = args.toStringArray(me?.inventory);
      const theirInventory = args.toStringArray(target?.inventory);
      if (!myInventory.length || !theirInventory.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Echange obligatoire : inventaire vide.`,
        );
        return addEffectLog('none');
      }
      const metaRng = args.createMetaRng(args.getMetadata(next));
      const pickA = args.pickOne(metaRng.getMeta(), myInventory);
      next = { ...next, metadata: pickA.meta };
      const giveA = String(pickA.value ?? '').trim();
      const pickB = args.pickOne(args.getMetadata(next), theirInventory);
      next = { ...next, metadata: pickB.meta };
      const giveB = String(pickB.value ?? '').trim();
      if (giveA)
        next = args.removeOneCourseFromPlayer(next, args.playerId, giveA).state;
      if (giveB)
        next = args.removeOneCourseFromPlayer(next, targetId, giveB).state;
      if (giveA) next = args.addOneCourseToPlayer(next, targetId, giveA);
      if (giveB) next = args.addOneCourseToPlayer(next, args.playerId, giveB);
      next = args.appendLog(
        next,
        `[Panier Express] Echange obligatoire : echange entre ${args.playerName(args.state, args.playerId)} et ${args.playerName(args.state, targetId)}.`,
      );
      return addEffectLog('swap_random', { targetId });
    }
    case 'inversion-de-panier': {
      const others = args
        .getPlayers(next)
        .filter((player) => player.id !== args.playerId)
        .map((player) => player.id);
      if (!others.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Inversion de panier : aucun joueur disponible.`,
        );
        return addEffectLog('none');
      }
      const metaRng = args.createMetaRng(args.getMetadata(next));
      const picked = args.pickOne(metaRng.getMeta(), others);
      next = { ...next, metadata: picked.meta };
      const targetId = Number(picked.value);
      const playersWithInventory = args.getPlayers(next).map((player) => {
        if (player.id !== args.playerId && player.id !== targetId)
          return player;
        return { ...player, inventory: args.toStringArray(player.inventory) };
      });
      const me = playersWithInventory.find(
        (player) => player.id === args.playerId,
      );
      const target = playersWithInventory.find(
        (player) => player.id === targetId,
      );
      const myInventory = args.toStringArray(me?.inventory);
      const theirInventory = args.toStringArray(target?.inventory);
      next = {
        ...next,
        players: playersWithInventory.map((player) => {
          const normalized = {
            ...player,
            username: player.username ?? `Joueur ${player.id}`,
          };
          if (player.id === args.playerId) {
            return { ...normalized, inventory: theirInventory };
          }
          if (player.id === targetId) {
            return { ...normalized, inventory: myInventory };
          }
          return normalized;
        }),
      };
      next = args.appendLog(
        next,
        `[Panier Express] Inversion de panier : echange d'inventaire avec ${args.playerName(args.state, targetId)}.`,
      );
      return addEffectLog('swap_inventory', { targetId });
    }
    case 'rupture-de-stock':
    case 'stand-detrempe':
      next = args.setTurnStatus(next, args.playerId, 'noDrawCourses', 1);
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel || args.event} : aucune pioche de course ce tour-ci.`,
      );
      return addEffectLog('no_draw');
    case 'marche-bonde':
    case 'file-attente-interminable':
    case 'panne-de-caisse':
      next = args.setTurnStatus(next, args.playerId, 'skipTurn', 1);
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel} : vous passez votre prochain tour.`,
      );
      return addEffectLog('skipTurn');
    case 'chariot-perce': {
      const discardedResult = args.discardRandomCourse(next, args.playerId);
      next = discardedResult.state;
      if (!discardedResult.discarded) {
        next = args.appendLog(
          next,
          `[Panier Express] Chariot perce : aucun ingredient a défausser.`,
        );
        return addEffectLog('none');
      }
      next = args.appendLog(
        next,
        `[Panier Express] Chariot perce : défausse "${args.formatCourseLabel(discardedResult.discarded)}".`,
      );
      return addEffectLog('discard_random', {
        card: discardedResult.discarded,
      });
    }
    default:
      if (
        args.event === 'erreur-de-livraison' ||
        args.event === 'produit-avarie' ||
        args.event === 'emballage-oublie'
      ) {
        const discardedResult = args.discardRandomCourse(next, args.playerId);
        next = discardedResult.state;
        next = args.appendLog(
          next,
          discardedResult.discarded
            ? `[Panier Express] ${args.playerName(args.state, args.playerId)} défausse "${args.formatCourseLabel(discardedResult.discarded)}".`
            : `[Panier Express] Aucune carte a défausser.`,
        );
        return addEffectLog('discard_random', {
          discarded: discardedResult.discarded,
        });
      }
      return null;
  }
}
