import type {
  GameStateEntity,
  PendingState,
} from '../models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import { formatPresenterActions } from '../helpers/actions-presenter.helper';

/**
 * Classe de base abstraite pour les services de prÃƒÆ’Ã‚Â©sentation de jeux.
 *
 * Utilise le pattern Template Method pour fournir une structure commune
 * tout en permettant la personnalisation par jeu.
 *
 * @abstract
 */
export abstract class BasePresenterService {
  /**
   * Expose l'ÃƒÆ’Ã‚Â©tat du jeu avec les actions et le pending state.
   *
   * Cette mÃƒÆ’Ã‚Â©thode template orchestre la construction de l'ÃƒÆ’Ã‚Â©tat exposÃƒÆ’Ã‚Â©
   * en appelant les mÃƒÆ’Ã‚Â©thodes abstraites et concrÃƒÆ’Ã‚Â¨tes appropriÃƒÆ’Ã‚Â©es.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param actions - Actions disponibles prÃƒÆ’Ã‚Â©-calculÃƒÆ’Ã‚Â©es (optionnel)
   * @returns ÃƒÆ’Ã¢â‚¬Â°tat enrichi pour le client
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
   * Expose l'ÃƒÆ’Ã‚Â©tat du jeu personnalisÃƒÆ’Ã‚Â© pour un utilisateur spÃƒÆ’Ã‚Â©cifique.
   *
   * Permet de masquer certaines informations selon le joueur
   * (main des adversaires, cartes cachÃƒÆ’Ã‚Â©es, etc.).
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param userId - ID de l'utilisateur
   * @param actions - Actions disponibles prÃƒÆ’Ã‚Â©-calculÃƒÆ’Ã‚Â©es (optionnel)
   * @returns ÃƒÆ’Ã¢â‚¬Â°tat enrichi personnalisÃƒÆ’Ã‚Â© pour cet utilisateur
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
   * @param actions - Actions ÃƒÆ’Ã‚Â  formater
   * @returns Actions formatÃƒÆ’Ã‚Â©es
   */
  protected formatActions(actions: GameSingleActionDto[]): Array<{
    type: string;
    label: string;
    payload: Record<string, unknown>;
  }> {
    return formatPresenterActions(actions, (a) => this.getActionLabel(a.type));
  }

  /**
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re le label d'une action (par dÃƒÆ’Ã‚Â©faut = type).
   *
   * Peut ÃƒÆ’Ã‚Âªtre surchargÃƒÆ’Ã‚Â©e pour fournir des labels personnalisÃƒÆ’Ã‚Â©s.
   *
   * @param actionType - Type de l'action
   * @returns Label de l'action
   */
  protected getActionLabel(actionType: string): string {
    return actionType;
  }

  /**
   * VÃƒÆ’Ã‚Â©rifie si le jeu a dÃƒÆ’Ã‚Â©marrÃƒÆ’Ã‚Â©.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @returns true si le jeu a dÃƒÆ’Ã‚Â©marrÃƒÆ’Ã‚Â©
   */
  protected isStarted(state: GameStateEntity): boolean {
    return String(state.status ?? '').toLowerCase() === 'started';
  }

  /**
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re l'ID du joueur courant.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @returns ID du joueur courant ou null
   */
  protected getCurrentPlayerId(state: GameStateEntity): number | null {
    return state.turn?.currentPlayerId ?? null;
  }

  /**
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re les mÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @returns MÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu
   */
  protected getMetadata(state: GameStateEntity): Record<string, unknown> {
    const metadata = state.metadata;
    if (metadata && typeof metadata === 'object') {
      return metadata as Record<string, unknown>;
    }
    return {};
  }

  /**
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re les extras existants dans l'ÃƒÆ’Ã‚Â©tat.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @returns Extras existants
   */
  protected getBaseExtras(state: GameStateEntity): Record<string, unknown> {
    const extrasFromState = (state as GameStateEntity & { extras?: unknown })
      .extras;
    return extrasFromState && typeof extrasFromState === 'object'
      ? extrasFromState
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
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re les actions disponibles pour le joueur courant.
   *
   * Par dÃƒÆ’Ã‚Â©faut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette mÃƒÆ’Ã‚Â©thode si elles ne passent pas les actions
   * en paramÃƒÆ’Ã‚Â¨tre ÃƒÆ’Ã‚Â  buildExposedState.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
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
   * RÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re les actions disponibles pour un utilisateur spÃƒÆ’Ã‚Â©cifique.
   *
   * Par dÃƒÆ’Ã‚Â©faut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette mÃƒÆ’Ã‚Â©thode si elles ne passent pas les actions
   * en paramÃƒÆ’Ã‚Â¨tre ÃƒÆ’Ã‚Â  buildExposedStateForUser.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
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
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param metadata - MÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Pending state ou null
   */
  protected abstract buildPendingState(
    state: GameStateEntity,
    metadata: Record<string, unknown>,
    currentPlayerId: number | null,
  ): PendingState | null;

  /**
   * Construit le pending state pour un utilisateur spÃƒÆ’Ã‚Â©cifique.
   *
   * Par dÃƒÆ’Ã‚Â©faut, retourne le mÃƒÆ’Ã‚Âªme pending state que buildPendingState.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param metadata - MÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu
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
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param metadata - MÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu
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
   * Cette mÃƒÆ’Ã‚Â©thode gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rique trouve le joueur dont c'est le tour.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
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
   * Construit les extras pour un utilisateur spÃƒÆ’Ã‚Â©cifique.
   *
   * Par dÃƒÆ’Ã‚Â©faut, retourne les mÃƒÆ’Ã‚Âªmes extras que buildExtras.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param metadata - MÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu
   * @param userId - ID de l'utilisateur
   * @param currentPlayerId - ID du joueur courant
   * @returns Extras personnalisÃƒÆ’Ã‚Â©s
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



