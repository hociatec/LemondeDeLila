import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { PanierExpressUtils } from '../model/panier-express-utils.service';
import {
  addCardToPlayerState,
  removeFromInventoryState,
  setInventoryState,
} from './panier-express-exchange-state.helpers';

export function applyPanierExpressExchangeCard(args: {
  state: GameStateEntity;
  initiatorPlayerId: number;
  targetPlayerId: number;
  card: string;
  utils: PanierExpressUtils;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  createMetaRng: (metadata: any) => { getMeta: () => any };
  pickOne: <T>(
    metadata: any,
    items: T[],
  ) => { meta: any; value: T | undefined };
}): GameStateEntity | null {
  const kind = String(args.card ?? '').trim();
  if (!kind) return args.state;

  if (kind === 'vol-discret') {
    const meta = (args.state.metadata ?? {}) as any;
    const target = (args.state.players ?? []).find(
      (player) => player.id === args.targetPlayerId,
    ) as any;
    const inventory = args.utils.toStringArray(target?.inventory);
    if (!inventory.length) {
      return args.appendLog(
        args.state,
        `[Panier Express] Vol discret : ${args.utils.playerName(args.state, args.targetPlayerId)} n'a aucune carte.`,
      );
    }
    const metaRng = args.createMetaRng(meta);
    const picked = args.pickOne(metaRng.getMeta(), inventory);
    const stolen = String(picked.value ?? '').trim();
    if (!stolen) return args.state;

    let next: GameStateEntity = { ...args.state, metadata: picked.meta };
    next = removeFromInventoryState(
      args.utils,
      next,
      args.targetPlayerId,
      stolen,
    );
    next = addCardToPlayerState(
      args.utils,
      next,
      args.initiatorPlayerId,
      stolen,
    );
    return args.appendLog(
      next,
      `[Panier Express] Vol discret : ${args.utils.playerName(args.state, args.initiatorPlayerId)} vole "${stolen}" a ${args.utils.playerName(args.state, args.targetPlayerId)}.`,
    );
  }

  if (kind === 'chariot-echange') {
    const initiator = (args.state.players ?? []).find(
      (player) => player.id === args.initiatorPlayerId,
    ) as any;
    const target = (args.state.players ?? []).find(
      (player) => player.id === args.targetPlayerId,
    ) as any;
    const initiatorInv = args.utils.toStringArray(initiator?.inventory);
    const targetInv = args.utils.toStringArray(target?.inventory);
    let next: GameStateEntity = args.state;
    next = setInventoryState(args.utils, next, args.initiatorPlayerId, []);
    next = setInventoryState(args.utils, next, args.targetPlayerId, []);
    targetInv.forEach((card) => {
      next = addCardToPlayerState(
        args.utils,
        next,
        args.initiatorPlayerId,
        card,
      );
    });
    initiatorInv.forEach((card) => {
      next = addCardToPlayerState(args.utils, next, args.targetPlayerId, card);
    });
    return args.appendLog(
      next,
      `[Panier Express] Chariot echange : ${args.utils.playerName(args.state, args.initiatorPlayerId)} echange son inventaire avec ${args.utils.playerName(args.state, args.targetPlayerId)}.`,
    );
  }

  if (kind === 'echange-force') {
    const initiator = (args.state.players ?? []).find(
      (player) => player.id === args.initiatorPlayerId,
    ) as any;
    const target = (args.state.players ?? []).find(
      (player) => player.id === args.targetPlayerId,
    ) as any;
    const initiatorInv = args.utils.toStringArray(initiator?.inventory);
    const targetInv = args.utils.toStringArray(target?.inventory);
    if (!initiatorInv.length || !targetInv.length) {
      return args.appendLog(
        args.state,
        `[Panier Express] Echange force : inventaire vide.`,
      );
    }

    let next: GameStateEntity = args.state;
    const metaRng = args.createMetaRng((next.metadata as any) ?? {});
    const pickA = args.pickOne(metaRng.getMeta(), initiatorInv);
    next = { ...next, metadata: pickA.meta };
    const aCard = String(pickA.value ?? '').trim();
    const pickB = args.pickOne((next.metadata as any) ?? {}, targetInv);
    next = { ...next, metadata: pickB.meta };
    const bCard = String(pickB.value ?? '').trim();

    if (aCard) {
      next = removeFromInventoryState(
        args.utils,
        next,
        args.initiatorPlayerId,
        aCard,
      );
    }
    if (bCard) {
      next = removeFromInventoryState(
        args.utils,
        next,
        args.targetPlayerId,
        bCard,
      );
    }
    if (aCard) {
      next = addCardToPlayerState(args.utils, next, args.targetPlayerId, aCard);
    }
    if (bCard) {
      next = addCardToPlayerState(
        args.utils,
        next,
        args.initiatorPlayerId,
        bCard,
      );
    }
    return args.appendLog(
      next,
      `[Panier Express] Echange force : echange au hasard entre ${args.utils.playerName(args.state, args.initiatorPlayerId)} et ${args.utils.playerName(args.state, args.targetPlayerId)}.`,
    );
  }

  if (kind === 'echange-impose') {
    const target = (args.state.players ?? []).find(
      (player) => player.id === args.targetPlayerId,
    ) as any;
    const inventory = args.utils.toStringArray(target?.inventory);
    if (!inventory.length) {
      return args.appendLog(
        args.state,
        `[Panier Express] Echange impose : ${args.utils.playerName(args.state, args.targetPlayerId)} n'a aucune carte.`,
      );
    }
    return {
      ...args.state,
      pending: {
        type: 'pick',
        playerId: args.targetPlayerId,
        blocking: true,
        label: `Choisissez une carte a donner a ${args.utils.playerName(args.state, args.initiatorPlayerId)}, puis Entree.`,
        choices: inventory,
        data: {
          kind: 'exchange.impose.choose_card',
          initiatorId: args.initiatorPlayerId,
          cards: inventory,
        },
      } as any,
    };
  }

  return null;
}
