import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import { GameValidationError } from '../../../common/errors/game-errors';

/**
 * Interface pour les handlers d'actions de jeu.
 *
 * Chaque handler traite un type d'action spécifique et retourne le nouvel état.
 */
export interface ActionHandler {
  /**
   * Type d'action géré par ce handler.
   */
  readonly actionType: string;

  /**
   * Traite l'action et retourne le nouvel état.
   *
   * @param state - État actuel du jeu
   * @param action - Action à traiter
   * @param actorId - ID de l'acteur effectuant l'action
   * @returns Nouvel état après traitement
   */
  handle(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity;
}

/**
 * Service de dispatch d'actions avec pattern Registry.
 *
 * Permet d'enregistrer des handlers pour chaque type d'action
 * et de les dispatcher de manière extensible.
 *
 * @example
 * ```typescript
 * // Dans le module du jeu
 * const dispatcher = new ActionDispatcherService();
 * dispatcher.register(new DrawActionHandler(setupService));
 * dispatcher.register(new DiscardActionHandler(setupService));
 *
 * // Dans applyActions
 * const newState = dispatcher.dispatch(state, action, actorId);
 * ```
 */
@Injectable()
export class ActionDispatcherService {
  private readonly handlers = new Map<string, ActionHandler>();

  /**
   * Enregistre un handler pour un type d'action.
   *
   * @param handler - Handler à enregistrer
   * @throws {Error} Si un handler est déjà enregistré pour ce type
   */
  register(handler: ActionHandler): void {
    const actionType = handler.actionType.toLowerCase();

    if (this.handlers.has(actionType)) {
      throw new Error(
        `Action handler already registered for action type: ${actionType}`,
      );
    }

    this.handlers.set(actionType, handler);
  }

  /**
   * Enregistre plusieurs handlers d'un coup.
   *
   * @param handlers - Handlers à enregistrer
   */
  registerMany(handlers: ActionHandler[]): void {
    handlers.forEach((handler) => this.register(handler));
  }

  /**
   * Dispatch une action vers le handler approprié.
   *
   * @param state - État actuel du jeu
   * @param action - Action à dispatcher
   * @param actorId - ID de l'acteur effectuant l'action
   * @returns Nouvel état après traitement
   *
   * @throws {GameValidationError} Si aucun handler n'est enregistré pour ce type
   */
  dispatch(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    const actionType = String(action?.type ?? '').toLowerCase();
    const handler = this.handlers.get(actionType);

    if (!handler) {
      throw new GameValidationError(
        `No handler registered for action type: ${actionType}`,
        {
          gameType: getGameType(state),
          action: actionType,
          registeredActions: Array.from(this.handlers.keys()),
        },
      );
    }

    return handler.handle(state, action, actorId);
  }

  /**
   * Vérifie si un handler est enregistré pour un type d'action.
   *
   * @param actionType - Type d'action à vérifier
   * @returns true si un handler est enregistré
   */
  hasHandler(actionType: string): boolean {
    return this.handlers.has(actionType.toLowerCase());
  }

  /**
   * Récupère la liste des types d'actions enregistrés.
   *
   * @returns Liste des types d'actions
   */
  getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Supprime tous les handlers enregistrés.
   *
   * Utile pour les tests ou la réinitialisation.
   */
  clear(): void {
    this.handlers.clear();
  }
}

function getMetadata(state: GameStateEntity): Record<string, unknown> {
  const metadata = state.metadata;
  return (metadata && typeof metadata === 'object' ? metadata : {}) as Record<
    string,
    unknown
  >;
}

function getGameType(state: GameStateEntity): string | undefined {
  const metadata = getMetadata(state);
  const gameType = metadata.gameType;
  return typeof gameType === 'string' ? gameType : undefined;
}
