import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import type { PanierExpressUtils } from '../model/panier-express-utils.service';
import {
  addCardToPlayerState,
  addToDiscardState,
  removeFromInventoryState,
  setInventoryState,
} from './panier-express-exchange-state.helpers';

export function requestPanierExpressSpecialExchange(args: {
  state: GameStateEntity;
  metadata: PanierExpressMetadata;
  playerId: number;
  resolvedCard: string;
  utils: PanierExpressUtils;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  nextInt: (
    metadata: any,
    maxExclusive: number,
  ) => { meta: any; value: number };
  pickOne: <T>(
    metadata: any,
    items: T[],
  ) => { meta: any; value: T | undefined };
  shuffle: <T>(metadata: any, items: T[]) => { meta: any; values: T[] };
}): GameStateEntity | null {
  const targetChoices = (state: GameStateEntity) =>
    (state.players ?? [])
      .filter((player) => player.id !== args.playerId)
      .map((player) => ({ playerId: player.id, username: player.username }));

  if (
    [
      'vol-discret',
      'chariot-echange',
      'echange-impose',
      'echange-force',
    ].includes(args.resolvedCard)
  ) {
    const targets = targetChoices(args.state);
    const choices = targets
      .map((target) => String(target.username ?? ''))
      .filter((value) => value.length > 0);
    if (!choices.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Aucun joueur disponible pour ${args.resolvedCard}.`,
      );
    }
    const exchangeLabel =
      args.utils.formatEventLabel(args.resolvedCard) || args.resolvedCard;
    return {
      ...args.state,
      metadata: args.metadata,
      pending: {
        type: 'pick',
        playerId: args.playerId,
        blocking: true,
        label: `Choisissez un joueur pour ${exchangeLabel}, puis Entree.`,
        choices,
        data: {
          kind: 'exchange.choose_target',
          card: args.resolvedCard,
          targets,
        },
      } as any,
    };
  }

  if (args.resolvedCard === 'troc-rapide') {
    const players = args.state.players ?? [];
    if (players.length < 2) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Troc rapide : aucun joueur disponible.`,
      );
    }
    const idx = players.findIndex((player) => player.id === args.playerId);
    const targetPlayerId = Number(
      players[(idx - 1 + players.length) % players.length]?.id,
    );
    const me = (args.state.players ?? []).find(
      (player) => player.id === args.playerId,
    ) as any;
    const inventory = args.utils.toStringArray(me?.inventory);
    if (!inventory.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Troc rapide : inventaire vide.`,
      );
    }
    return {
      ...args.state,
      metadata: args.metadata,
      pending: {
        type: 'pick',
        playerId: args.playerId,
        blocking: true,
        label: `Choisissez une carte a echanger avec ${args.utils.playerName(args.state, targetPlayerId)}, puis Entree.`,
        choices: inventory,
        data: { kind: 'exchange.troc_rapide.choose_give', targetPlayerId },
      } as any,
    };
  }

  if (
    args.resolvedCard === 'troc-fruit-legume' ||
    args.resolvedCard === 'echange-saison' ||
    args.resolvedCard === 'echange-strategique'
  ) {
    const targets = targetChoices(args.state);
    const choices = targets
      .map((target) => String(target.username ?? ''))
      .filter((value) => value.length > 0);
    if (!choices.length) {
      const label =
        args.resolvedCard === 'troc-fruit-legume'
          ? 'Troc fruit/legume'
          : args.resolvedCard === 'echange-saison'
            ? 'Echange de saison'
            : 'Echange strategique';
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] ${label} : aucun joueur disponible.`,
      );
    }

    if (args.resolvedCard === 'echange-strategique') {
      const exchangeIdOut = args.nextInt(args.metadata as any, 1_000_000_000);
      return {
        ...args.state,
        metadata: exchangeIdOut.meta,
        pending: {
          type: 'pick',
          playerId: args.playerId,
          blocking: true,
          label:
            "Choisissez un joueur pour l'echange strategique, puis Entree.",
          choices,
          data: {
            kind: 'exchange.strategique.choose_target',
            exchangeId: exchangeIdOut.value,
            targets,
          },
        } as any,
      };
    }

    return {
      ...args.state,
      metadata: args.metadata,
      pending: {
        type: 'pick',
        playerId: args.playerId,
        blocking: true,
        label:
          args.resolvedCard === 'troc-fruit-legume'
            ? 'Choisissez un joueur pour le troc, puis Entree.'
            : "Choisissez un joueur pour l'echange de saison, puis Entree.",
        choices,
        data: {
          kind:
            args.resolvedCard === 'troc-fruit-legume'
              ? 'exchange.troc_fruit_legume.choose_target'
              : 'exchange.echange_saison.choose_target',
          targets,
        },
      } as any,
    };
  }

  if (args.resolvedCard === 'marche-noir') {
    const me = (args.state.players ?? []).find(
      (player) => player.id === args.playerId,
    ) as any;
    const cards = args.utils.toStringArray(me?.inventory);
    if (!cards.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Marche noir : aucune carte a defausser.`,
      );
    }
    return {
      ...args.state,
      metadata: args.metadata,
      pending: {
        type: 'pick',
        playerId: args.playerId,
        blocking: true,
        label: 'Choisissez une carte a defausser, puis Entree.',
        choices: cards,
        data: { kind: 'exchange.marche_noir.discard' },
      } as any,
    };
  }

  if (
    args.resolvedCard === 'echange-devant' ||
    args.resolvedCard === 'echange-derriere'
  ) {
    const exchangeLabel = args.utils.formatEventLabel(args.resolvedCard);
    const players = args.state.players ?? [];
    if (players.length < 2) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] ${exchangeLabel} : aucun joueur disponible.`,
      );
    }
    const idx = players.findIndex((player) => player.id === args.playerId);
    const targetPlayerId = Number(
      players[
        args.resolvedCard === 'echange-devant'
          ? (idx + 1) % players.length
          : (idx - 1 + players.length) % players.length
      ]?.id,
    );
    const me = (args.state.players ?? []).find(
      (player) => player.id === args.playerId,
    ) as any;
    const target = (args.state.players ?? []).find(
      (player) => player.id === targetPlayerId,
    ) as any;
    const myInv = args.utils.toStringArray(me?.inventory);
    const theirInv = args.utils.toStringArray(target?.inventory);
    if (!myInv.length || !theirInv.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] ${exchangeLabel} : inventaire vide.`,
      );
    }
    return {
      ...args.state,
      metadata: args.metadata,
      pending: {
        type: 'pick',
        playerId: args.playerId,
        blocking: true,
        label: `Choisissez une carte a echanger avec ${args.utils.playerName(args.state, targetPlayerId)}, puis Entree.`,
        choices: myInv,
        data: {
          kind: 'exchange.voisin.choose_give',
          targetPlayerId,
          exchangeLabel,
        },
      } as any,
    };
  }

  if (args.resolvedCard === 'panier-mixe') {
    const metaAny = args.metadata as any;
    const positions = (metaAny.positions ?? {}) as Record<number, number>;
    const tiles = Array.isArray(metaAny.tiles) ? metaAny.tiles : [];
    const total = tiles.length || 1;
    const others = (args.state.players ?? []).filter(
      (player) => player.id !== args.playerId,
    );
    if (!others.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Panier mixe : aucun joueur disponible.`,
      );
    }
    const mePos = positions[args.playerId] ?? 0;
    let targetPlayerId = others[0].id;
    let bestDist = Number.POSITIVE_INFINITY;
    others.forEach((player) => {
      const pos = positions[player.id] ?? 0;
      const forward = (pos - mePos + total) % total;
      const backward = (mePos - pos + total) % total;
      const dist = Math.min(forward, backward);
      if (dist < bestDist) {
        bestDist = dist;
        targetPlayerId = player.id;
      }
    });
    const me = (args.state.players ?? []).find(
      (player) => player.id === args.playerId,
    ) as any;
    const target = (args.state.players ?? []).find(
      (player) => player.id === targetPlayerId,
    ) as any;
    const aInv = args.utils.toStringArray(me?.inventory);
    const bInv = args.utils.toStringArray(target?.inventory);
    const combined = [...aInv, ...bInv];
    if (!combined.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Panier mixe : aucun inventaire a melanger.`,
      );
    }
    const shuffled = args.shuffle((args.metadata as any) ?? {}, combined);
    let next: GameStateEntity = { ...args.state, metadata: shuffled.meta };
    next = setInventoryState(args.utils, next, args.playerId, []);
    next = setInventoryState(args.utils, next, targetPlayerId, []);
    const half = Math.floor(shuffled.values.length / 2);
    const aCards = shuffled.values.slice(0, half);
    const bCards = shuffled.values.slice(half, half * 2);
    const leftover = shuffled.values.slice(half * 2);
    aCards.forEach((card) => {
      next = addCardToPlayerState(args.utils, next, args.playerId, card);
    });
    bCards.forEach((card) => {
      next = addCardToPlayerState(args.utils, next, targetPlayerId, card);
    });
    leftover.forEach((card) => {
      next = addToDiscardState(next, card);
    });
    return args.appendLog(
      next,
      `[Panier Express] Panier mixe : melange avec ${args.utils.playerName(args.state, targetPlayerId)}.`,
    );
  }

  if (args.resolvedCard === 'echange-masque') {
    const eligible = (args.state.players ?? []).filter(
      (player: any) => args.utils.toStringArray(player.inventory).length > 0,
    );
    if (eligible.length < 2) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Echange masque : pas assez de joueurs avec des cartes.`,
      );
    }
    const shuffledPlayers = args.shuffle(
      (args.metadata as any) ?? {},
      eligible.map((player) => player.id),
    );
    let next: GameStateEntity = {
      ...args.state,
      metadata: shuffledPlayers.meta,
    };
    const pickedByPlayer: Record<number, string> = {};
    for (const pid of shuffledPlayers.values) {
      const inv = args.utils.toStringArray(
        (next.players ?? []).find((player: any) => player.id === pid)
          ?.inventory,
      );
      const pick = args.pickOne((next.metadata as any) ?? {}, inv);
      next = { ...next, metadata: pick.meta };
      const card = String(pick.value ?? '').trim();
      if (!card) continue;
      pickedByPlayer[pid] = card;
      next = removeFromInventoryState(args.utils, next, pid, card);
    }
    const ids = shuffledPlayers.values;
    for (let i = 0; i < ids.length; i += 1) {
      const giverId = ids[i];
      const receiverId = ids[(i + 1) % ids.length];
      const card = pickedByPlayer[giverId];
      if (card) {
        next = addCardToPlayerState(args.utils, next, receiverId, card);
      }
    }
    return args.appendLog(
      next,
      `[Panier Express] Echange masque : echange realise.`,
    );
  }

  if (args.resolvedCard === 'panier-collectif') {
    const players = args.state.players ?? [];
    const contributors: number[] = [];
    let pot: string[] = [];
    let next: GameStateEntity = { ...args.state, metadata: args.metadata };
    for (const player of players) {
      const inv = args.utils.toStringArray((player as any).inventory);
      if (!inv.length) continue;
      const pick = args.pickOne((next.metadata as any) ?? {}, inv);
      next = { ...next, metadata: pick.meta };
      const card = String(pick.value ?? '').trim();
      if (!card) continue;
      contributors.push(player.id);
      pot.push(card);
      next = removeFromInventoryState(args.utils, next, player.id, card);
    }
    if (!pot.length || contributors.length < 2) {
      return args.appendLog(
        next,
        `[Panier Express] Inventaire collectif : pas assez de cartes dans le pot.`,
      );
    }
    const shuffledPot = args.shuffle((next.metadata as any) ?? {}, pot);
    next = { ...next, metadata: shuffledPot.meta };
    pot = shuffledPot.values;
    for (let i = 0; i < contributors.length; i += 1) {
      next = addCardToPlayerState(args.utils, next, contributors[i], pot[i]);
    }
    return args.appendLog(
      next,
      `[Panier Express] Inventaire collectif : redistribution d'inventaire effectuee.`,
    );
  }

  if (args.resolvedCard === 'echange-simultane') {
    const players = args.state.players ?? [];
    if (players.length < 2) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Echange simultane : aucun joueur disponible.`,
      );
    }
    let next: GameStateEntity = { ...args.state, metadata: args.metadata };
    const toPass: Array<{ from: number; card: string }> = [];
    for (const player of players) {
      const inv = args.utils.toStringArray((player as any).inventory);
      if (!inv.length) continue;
      const pick = args.pickOne((next.metadata as any) ?? {}, inv);
      next = { ...next, metadata: pick.meta };
      const card = String(pick.value ?? '').trim();
      if (!card) continue;
      toPass.push({ from: player.id, card });
      next = removeFromInventoryState(args.utils, next, player.id, card);
    }
    for (const entry of toPass) {
      const idx = players.findIndex((player) => player.id === entry.from);
      const targetId = players[(idx + 1) % players.length].id;
      next = addCardToPlayerState(args.utils, next, targetId, entry.card);
    }
    for (const entry of toPass) {
      const idx = players.findIndex((player) => player.id === entry.from);
      const targetId = players[(idx + 1) % players.length].id;
      next = args.appendLog(
        next,
        `[Panier Express] Echange simultane : ${args.utils.playerName(args.state, entry.from)} donne "${args.utils.formatCourseLabel(entry.card)}" a ${args.utils.playerName(args.state, targetId)}.`,
      );
    }
    return next;
  }

  if (args.resolvedCard === 'defausse-aleatoire') {
    const inventory = args.utils.toStringArray(
      (args.state.players ?? []).find((player) => player.id === args.playerId)
        ?.inventory,
    );
    if (!inventory.length) {
      return args.appendLog(
        { ...args.state, metadata: args.metadata },
        `[Panier Express] Defausse aleatoire : inventaire vide.`,
      );
    }
    const metaRng = args.createMetaRng(args.metadata as any);
    const picked = args.pickOne(metaRng.getMeta(), inventory);
    const card = String(picked.value ?? '').trim();
    const updatedMeta = picked.meta;
    const players = (args.state.players ?? []).map((player: any) => {
      if (player.id !== args.playerId) return player;
      const nextInv = args.utils.removeOne(inventory, card);
      return { ...player, inventory: nextInv };
    });
    const cardLabel = args.utils.formatCourseLabel(card);
    return args.appendLog(
      addToDiscardState(
        { ...args.state, players, metadata: updatedMeta },
        card,
      ),
      `[Panier Express] Defausse aleatoire : ${args.utils.playerName(args.state, args.playerId)} defausse "${cardLabel}".`,
    );
  }

  return null;
}
