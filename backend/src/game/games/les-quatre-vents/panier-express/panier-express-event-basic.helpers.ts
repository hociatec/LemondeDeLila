import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { PanierExpressMetadata } from './model/panier-express-state.entity';

export function applyBasicPanierExpressEvent(args: {
  event: string;
  eventLabel: string;
  state: GameStateEntity;
  next: GameStateEntity;
  playerId: number;
  setPickPending: (params: {
    label: string;
    kind: string;
    choices: string[];
    data?: Record<string, unknown>;
  }) => GameStateEntity;
  buildTargets: (
    excludePlayerId: number,
  ) => Array<{ playerId: number; username?: string | null }>;
  buildTargetChoices: (
    targets: Array<{ playerId: number; username?: string | null }>,
  ) => string[];
  getPlayers: (state: GameStateEntity) => Array<{
    id: number;
    username?: string | null;
    inventory?: unknown;
  }>;
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
    value: number,
  ) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
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
}): GameStateEntity | null {
  let next = args.next;

  switch (args.event) {
    case 'stand-ferme':
      next = args.setTurnStatus(next, args.playerId, 'skipTurn', 1);
      next = args.appendLog(
        next,
        `[Panier Express] Stand fermé : ${args.playerName(args.state, args.playerId)} saute un tour.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'skipTurn',
      });
    case 'promo-surprise':
      next = args.appendLog(
        next,
        `[Panier Express] Promo surprise : ${args.playerName(args.state, args.playerId)} pioche 2 courses.`,
      );
      next = args.queueCourseDraws(
        next,
        [
          { playerId: args.playerId, standId: 'bonus' },
          { playerId: args.playerId, standId: 'bonus' },
        ],
        'Piocher une course bonus (Espace).',
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'draw2',
      });
    case 'coup-de-chance':
      next = args.appendLog(
        next,
        `[Panier Express] Coup de chance : ${args.playerName(args.state, args.playerId)} avance de 2 cases.`,
      );
      next = args.applyMoveDelta(next, args.playerId, 2);
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'move',
        delta: 2,
      });
    case 'stand-exceptionnel':
      next = args.appendLog(
        next,
        `[Panier Express] Stand exceptionnel : pioche 1 course bonus.`,
      );
      next = args.queueCourseDraws(
        next,
        [{ playerId: args.playerId, standId: 'bonus' }],
        'Piocher une course bonus (Espace).',
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'draw',
      });
    case 'fidelite-recompensee':
      next = args.setTurnStatus(next, args.playerId, 'keepTurn', 1);
      next = args.appendLog(
        next,
        `[Panier Express] Fidélité récompensée : rejouez immédiatement.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'keepTurn',
      });
    case 'panier-bonus': {
      const targets = args.buildTargets(args.playerId);
      const choices = args.buildTargetChoices(targets);
      if (!choices.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Panier bonus : aucun joueur disponible.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      next = args.setPickPending({
        label: 'Choisissez un joueur à qui prendre une carte, puis Entrée.',
        kind: 'event.panier_bonus.choose_target',
        choices,
        data: { targets },
      });
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'pick',
      });
    }
    case 'tirage-chanceux':
      next = args.startDrawPending(
        next,
        args.playerId,
        { kind: 'event.tirage_chanceux' },
        'Tirage chanceux : piocher 3 cartes (Espace).',
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'pick',
      });
    case 'producteur-genereux':
      next = args.startDrawPending(
        next,
        args.playerId,
        { kind: 'event.producteur_genereux' },
        'Producteur généreux : piocher 2 courses bonus (Espace).',
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'pick',
      });
    case 'emballage-defectueux': {
      const me = args.getPlayers(next).find((player) => player.id === args.playerId);
      const cards = args.toStringArray(me?.inventory);
      if (!cards.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Emballage défectueux : aucune carte à défausser.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      next = args.setPickPending({
        label: 'Choisissez une carte à défausser, puis Entrée.',
        kind: 'event.discard',
        choices: cards,
        data: { cards },
      });
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'pick_discard',
      });
    }
    case 'retour-en-arriere':
      next = args.appendLog(
        next,
        `[Panier Express] Retour en arrière : reculez de 3 cases.`,
      );
      next = args.applyMoveDelta(next, args.playerId, -3);
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'move',
        delta: -3,
      });
    case 'inspection-sanitaire':
      next = args.setTurnStatus(
        next,
        args.playerId,
        'revealInventory',
        Math.max(1, (next.players ?? []).length),
      );
      next = args.setTurnStatus(next, args.playerId, 'noDrawCourses', 1);
      next = args.appendLog(
        next,
        `[Panier Express] Inspection sanitaire : votre inventaire est visible jusqu'à votre prochain tour.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'reveal',
      });
    case 'file-inversee': {
      const metaNow = args.getMetadata(next);
      next = {
        ...next,
        metadata: {
          ...metaNow,
          movementDirection: -1,
          movementDirectionOwnerId: args.playerId,
        },
        turn: {
          ...(next.turn ?? { currentPlayerId: args.playerId, direction: 1 }),
          direction: -1,
        },
      };
      next = args.appendLog(
        next,
        `[Panier Express] File inversée : les joueurs reculent jusqu'à votre prochain tour.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'reverse',
      });
    }
    case 'don-du-maraicher':
      next = args.appendLog(
        next,
        `[Panier Express] Don du maraîcher : pioche 1 course bonus.`,
      );
      next = args.queueCourseDraws(
        next,
        [{ playerId: args.playerId, standId: 'bonus' }],
        'Piocher une course bonus (Espace).',
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'draw',
      });
    case 'marche-anime':
      next = args.queueCourseDraws(
        next,
        args.getPlayers(next).map((player) => ({
          playerId: player.id,
          standId: 'bonus',
        })),
        'Piocher une course bonus (Espace).',
      );
      next = args.appendLog(
        next,
        `[Panier Express] Marché animé : tous les joueurs piochent 1 course.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'all_draw',
      });
    case 'stand-ouvert-en-avance': {
      const metaNow = args.getMetadata(next);
      const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
      const total = tiles.length;
      const current = metaNow.positions?.[args.playerId] ?? 0;
      const direction = next.turn?.direction === -1 ? -1 : 1;
      let stands = 0;
      let stepsToMove = 0;
      for (let steps = 1; steps < total; steps += 1) {
        const idx = args.moveCircular(total, current, steps * direction);
        const tile = tiles[idx];
        if (tile?.type === 'stand') {
          stands += 1;
          if (stands >= 2) {
            stepsToMove = steps * direction;
            break;
          }
        }
      }
      if (!stepsToMove) {
        next = args.appendLog(
          next,
          `[Panier Express] Stand ouvert en avance : aucun stand trouvé.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      next = args.appendLog(
        next,
        `[Panier Express] Stand ouvert en avance : avance de 2 stands.`,
      );
      next = args.movePlayer(next, args.playerId, stepsToMove);
      next = args.resolveTile(next, args.playerId);
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'move_to_stand',
        stepsToMove,
      });
    }
    case 'echange-spontane': {
      const me = args.getPlayers(next).find((player) => player.id === args.playerId);
      const inventory = args.toStringArray(me?.inventory);
      const targets = args.buildTargets(args.playerId);
      const choices = args.buildTargetChoices(targets);
      if (!inventory.length || !choices.length) {
        next = args.appendLog(
          next,
          `[Panier Express] Échange spontané : aucun échange possible.`,
        );
        return args.appendActionLog(next, args.playerId, 'event', {
          event: args.event,
          effect: 'none',
        });
      }
      next = args.setPickPending({
        label: "Choisissez un joueur pour l'échange, puis Entrée.",
        kind: 'event.echange_spontane.choose_target',
        choices,
        data: { targets, giveChoices: inventory },
      });
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'pick',
      });
    }
    case 'intemperie-au-marche':
      next = args.appendLog(
        next,
        `[Panier Express] Intempérie : tous les joueurs reculent d'une case.`,
      );
      args.getPlayers(next).forEach((player) => {
        next = args.movePlayer(next, player.id, -1);
      });
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'all_move',
        delta: -1,
      });
    case 'pause-fatigue': {
      const metaNow = args.getMetadata(next);
      const tiles = Array.isArray(metaNow.tiles) ? metaNow.tiles : [];
      const index0 = Math.max(0, Math.min(tiles.length - 1, 39));
      next = {
        ...next,
        metadata: {
          ...metaNow,
          positions: { ...(metaNow.positions ?? {}), [args.playerId]: index0 },
        },
      };
      next = args.appendLog(
        next,
        `[Panier Express] ${args.eventLabel} : avance jusqu'à la case 40.`,
      );
      return args.appendActionLog(next, args.playerId, 'event', {
        event: args.event,
        effect: 'goto40',
      });
    }
    default:
      return null;
  }
}
