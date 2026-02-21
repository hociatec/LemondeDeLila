import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../dto/game-action.dto';
import {
  GameStateEntity,
  PendingState,
} from '../../core/entities/game-state.entity';
import { formatPresenterActions } from '../../presenters/actions-presenter.helper';

/**
 * Classe de base abstraite pour les services de présentation de jeux.
 *
 * Utilise le pattern Template Method pour fournir une structure commune
 * tout en permettant la personnalisation par jeu.
 *
 * @abstract
 */
export abstract class BasePresenterService {
  /**
   * Expose l'état du jeu avec les actions et le pending state.
   *
   * Cette méthode template orchestre la construction de l'état exposé
   * en appelant les méthodes abstraites et concrètes appropriées.
   *
   * @param state - État actuel du jeu
   * @param actions - Actions disponibles pré-calculées (optionnel)
   * @returns État enrichi pour le client
   */
  protected buildExposedState(
    state: GameStateEntity,
    actions?: GameSingleActionDto[],
  ): GameStateWithActions {
    const currentId = this.getCurrentPlayerId(state);
    const metadata = this.getMetadata(state);

    const availableActions =
      actions ?? this.getAvailableActions(state, currentId);
    const pending = this.buildPendingState(state, metadata, currentId);
    const extras = this.buildExtras(state, metadata, currentId);
    const catalog = this.buildCatalog();

    return {
      ...state,
      catalog,
      actions: this.formatActions(availableActions),
      pending,
      extras,
    } as GameStateWithActions;
  }

  /**
   * Expose l'état du jeu personnalisé pour un utilisateur spécifique.
   *
   * Permet de masquer certaines informations selon le joueur
   * (main des adversaires, cartes cachées, etc.).
   *
   * @param state - État actuel du jeu
   * @param userId - ID de l'utilisateur
   * @param actions - Actions disponibles pré-calculées (optionnel)
   * @returns État enrichi personnalisé pour cet utilisateur
   */
  protected buildExposedStateForUser(
    state: GameStateEntity,
    userId: number,
    actions?: GameSingleActionDto[],
  ): GameStateWithActions {
    const currentId = this.getCurrentPlayerId(state);
    const metadata = this.getMetadata(state);

    const availableActions =
      actions ?? this.getAvailableActionsForUser(state, userId);
    const pending = this.buildPendingStateForUser(
      state,
      metadata,
      userId,
      currentId,
    );
    const extras = this.buildExtrasForUser(state, metadata, userId, currentId);
    const catalog = this.buildCatalog();

    return {
      ...state,
      catalog,
      actions: this.formatActions(availableActions),
      pending,
      extras,
    } as GameStateWithActions;
  }

  /**
   * Formate les actions en objets { type, label, payload }.
   *
   * @param actions - Actions à formater
   * @returns Actions formatées
   */
  protected formatActions(actions: GameSingleActionDto[]): Array<{
    type: string;
    label: string;
    payload: Record<string, unknown>;
  }> {
    return formatPresenterActions(actions, (a) => this.getActionLabel(a.type));
  }

  /**
   * Récupère le label d'une action (par défaut = type).
   *
   * Peut être surchargée pour fournir des labels personnalisés.
   *
   * @param actionType - Type de l'action
   * @returns Label de l'action
   */
  protected getActionLabel(actionType: string): string {
    return actionType;
  }

  /**
   * Vérifie si le jeu a démarré.
   *
   * @param state - État actuel du jeu
   * @returns true si le jeu a démarré
   */
  protected isStarted(state: GameStateEntity): boolean {
    return String(state.status ?? '').toLowerCase() === 'started';
  }

  /**
   * Récupère l'ID du joueur courant.
   *
   * @param state - État actuel du jeu
   * @returns ID du joueur courant ou null
   */
  protected getCurrentPlayerId(state: GameStateEntity): number | null {
    return state.turn?.currentPlayerId ?? null;
  }

  /**
   * Récupère les métadonnées du jeu.
   *
   * @param state - État actuel du jeu
   * @returns Métadonnées du jeu
   */
  protected getMetadata(state: GameStateEntity): Record<string, unknown> {
    const metadata = state.metadata;
    if (metadata && typeof metadata === 'object') {
      return metadata as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Récupère les extras existants dans l'état.
   *
   * @param state - État actuel du jeu
   * @returns Extras existants
   */
  protected getBaseExtras(state: GameStateEntity): Record<string, unknown> {
    const extrasFromState = (state as GameStateEntity & { extras?: unknown })
      .extras;
    return extrasFromState && typeof extrasFromState === 'object'
      ? (extrasFromState as Record<string, unknown>)
      : {};
  }

  /**
   * Construit le catalog (phases + victory).
   *
   * @abstract
   * @returns Catalog du jeu
   */
  protected abstract buildCatalog(): {
    phases: string[];
    victory: unknown;
  };

  /**
   * Récupère les actions disponibles pour le joueur courant.
   *
   * Par défaut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette méthode si elles ne passent pas les actions
   * en paramètre à buildExposedState.
   *
   * @param state - État actuel du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Actions disponibles
   */
  protected getAvailableActions(
    _state: GameStateEntity,
    _currentPlayerId: number | null,
  ): GameSingleActionDto[] {
    void _state;
    void _currentPlayerId;
    return [];
  }

  /**
   * Récupère les actions disponibles pour un utilisateur spécifique.
   *
   * Par défaut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette méthode si elles ne passent pas les actions
   * en paramètre à buildExposedStateForUser.
   *
   * @param state - État actuel du jeu
   * @param userId - ID de l'utilisateur
   * @returns Actions disponibles
   */
  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    return this.getAvailableActions(state, userId);
  }

  /**
   * Construit le pending state global.
   *
   * @abstract
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Pending state ou null
   */
  protected abstract buildPendingState(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    currentPlayerId: number | null,
  ): PendingState | null;

  /**
   * Construit le pending state pour un utilisateur spécifique.
   *
   * Par défaut, retourne le même pending state que buildPendingState.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param userId - ID de l'utilisateur
   * @param currentPlayerId - ID du joueur courant
   * @returns Pending state ou null
   */
  protected buildPendingStateForUser(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    userId: number,
    currentPlayerId: number | null,
  ): PendingState | null {
    void metadata;
    void currentPlayerId;
    const pending = this.buildPendingState(state, metadata, currentPlayerId);
    return this.filterPendingForUser(pending, userId);
  }

  protected shouldExposePendingToUser(
    pending: PendingState | null,
    userId: number,
  ): boolean {
    if (!pending) return false;
    const ownerId =
      typeof pending?.playerId === 'number' ? pending.playerId : null;
    if (ownerId == null) return true;
    return ownerId === userId;
  }

  protected filterPendingForUser(
    pending: PendingState | null,
    userId: number,
    fallback: PendingState | null = null,
  ): PendingState | null {
    return this.shouldExposePendingToUser(pending, userId) ? pending : fallback;
  }

  /**
   * Construit les extras globaux.
   *
   * @abstract
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Extras
   */
  protected abstract buildExtras(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    currentPlayerId: number | null,
  ): Record<string, unknown>;

  /**
   * Construit la vue du joueur actuel pour les extras.
   * Cette méthode générique trouve le joueur dont c'est le tour.
   *
   * @param state - État actuel du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Vue du joueur courant ou null
   */
  protected buildCurrentPlayerView(
    state: GameStateEntity,
    currentPlayerId: number | null,
  ): { id: number; username: string } | null {
    if (currentPlayerId === null) return null;
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === currentPlayerId);
    if (!player) return null;
    return {
      id: player.id,
      username: player.username ?? `Joueur ${player.id}`,
    };
  }

  /**
   * Construit les extras pour un utilisateur spécifique.
   *
   * Par défaut, retourne les mêmes extras que buildExtras.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param userId - ID de l'utilisateur
   * @param currentPlayerId - ID du joueur courant
   * @returns Extras personnalisés
   */
  protected buildExtrasForUser(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    _userId: number,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    return this.buildExtras(state, metadata, currentPlayerId);
  }
}
