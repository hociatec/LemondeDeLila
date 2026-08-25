import { GameStateEntity } from '../../../core/application/models/game-state.model';
import { PanierExpressMetadata } from './model/panier-express-state.model';
import type { PanierExpressPlayer } from './model/panier-express-state.model';
import { toText } from './panier-express-state.helpers';
import { applyAdvancedPanierExpressEventBatch } from './panier-express-event-advanced-batch.helpers';

export function applyAdvancedPanierExpressEvent(args: {
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
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ) => GameStateEntity;
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
  addToDiscard: (state: GameStateEntity, card: string) => GameStateEntity;
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

  switch (args.event) {
    case 'journee-bio': {
      const metaNow = args.getMetadata(next);
      const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
      const positions = metaNow.positions ?? {};
      const targets = args
        .getPlayers(next)
        .map((player) => {
          const pos = positions[player.id] ?? 0;
          const tile = tiles[pos];
          if (
            tile?.type === 'stand' &&
            toText(tile.standId).startsWith('bio')
          ) {
            return { playerId: player.id, standId: 'bonus' };
          }
          return null;
        })
        .filter(
          (target): target is { playerId: number; standId: string } =>
            target !== null && Number.isFinite(target.playerId),
        );

      if (targets.length) {
        next = args.queueCourseDraws(
          next,
          targets,
          'Piocher une course bonus (Espace).',
        );
      }

      const targetNames = targets
        .map((target) => args.playerName(next, target.playerId))
        .filter((name) => name.length > 0);
      next = args.appendLog(
        next,
        targetNames.length
          ? `[Panier Express] Journée bio: bonus pour ${targetNames.join(', ')}.`
          : `[Panier Express] Journée bio: aucun joueur sur un stand Bio.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'multi_draw',
      });
    }
    case 'recette-express': {
      const me = args
        .getPlayers(next)
        .find((player) => player.id === args.playerId);
      const list = args.toStringArray(me?.shoppingList ?? []);
      const basket = args.toStringArray(me?.basket ?? []);
      const inventory = args.toStringArray(me?.inventory ?? []);
      const requiredItems = ['salade', 'tomate', 'oignon'];
      const requirementLabel = 'salade, tomate et oignon requis';
      if (
        list.length === 0 ||
        !requiredItems.every((item) => inventory.includes(item))
      ) {
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel} : condition non remplie (${requirementLabel}).`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }

      const metaRng = args.createMetaRng(args.getMetadata(next));
      const picked = args.pickOne(metaRng.getMeta(), list);
      next = { ...next, metadata: picked.meta };
      const card = String(picked.value ?? '').trim();
      if (!card) {
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }

      if (basket.includes(card) || inventory.includes(card)) {
        next = args.addToDiscard(next, card);
        next = args.setTurnStatus(next, args.playerId, 'keepTurn', 1);
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel}: vous piochez « ${args.formatCourseLabel(card)} », mais cet ingrédient est déjà dans le panier. Il est donc défaussé. Vous rejouez immédiatement.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'discard_keep_turn',
          card,
        });
      }

      next = args.addOneCourseToPlayer(next, args.playerId, card);
      const playerNow = args
        .getPlayers(next)
        .find((player) => player.id === args.playerId);
      const kept =
        args.toStringArray(playerNow?.basket).includes(card) ||
        args.toStringArray(playerNow?.inventory).includes(card);
      if (!kept) {
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel}: "${args.formatCourseLabel(card)}" est défaussé.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'discard',
          card,
        });
      }

      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel}: reçoit "${args.formatCourseLabel(card)}".`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'grant',
        card,
      });
    }
    case 'stand-en-fete': {
      const metaNow = args.getMetadata(next);
      const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
      const total = tiles.length;
      const position = metaNow.positions?.[args.playerId] ?? 0;
      let bestIndex: number | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let idx = 0; idx < total; idx += 1) {
        const tile = tiles[idx];
        if (tile?.type !== 'stand') continue;
        const forward = (idx - position + total) % total;
        const backward = (position - idx + total) % total;
        const dist = Math.min(forward, backward);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = idx;
        }
      }
      if (bestIndex == null) {
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel} : aucun stand trouve.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      const targets = args
        .getPlayers(next)
        .filter(
          (player) => (metaNow.positions?.[player.id] ?? 0) === bestIndex,
        );
      if (!targets.length) {
        next = args.appendLog(
          next,
          `[Panier Express] ${args.eventLabel} : aucun joueur sur le stand.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      next = args.queueCourseDraws(
        next,
        targets.map((player) => ({ playerId: player.id, standId: 'bonus' })),
        'Piocher une course bonus (Espace).',
      );
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel} : bonus pour les joueurs sur le stand.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'multi_draw',
        count: targets.length,
      });
    }
    default:
      return applyAdvancedPanierExpressEventBatch(args);
  }
}
