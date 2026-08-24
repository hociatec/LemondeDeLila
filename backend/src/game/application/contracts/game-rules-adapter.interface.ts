import { GameStateEntity } from '../models/game-state.model';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import type { BotStrategy } from './bot-strategy.interface';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../models/game-shortcuts.model';

/**
 * Interface principale pour les adaptateurs de rÃƒÆ’Ã‚Â¨gles de jeu.
 *
 * Chaque jeu doit implÃƒÆ’Ã‚Â©menter cette interface pour s'intÃƒÆ’Ã‚Â©grer au moteur de jeu.
 * L'adaptateur gÃƒÆ’Ã‚Â¨re l'initialisation, la validation et l'application des actions,
 * ainsi que l'exposition de l'ÃƒÆ’Ã‚Â©tat pour les clients.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyGameService implements GameRulesAdapter {
 *   readonly gameType = 'my-game';
 *   readonly category = 'strategy';
 *   readonly displayName = 'My Awesome Game';
 *   readonly minPlayers = 2;
 *   readonly maxPlayers = 4;
 *
 *   hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
 *     // Initialize game-specific metadata and state
 *     return { ...baseState, metadata: { ... } };
 *   }
 *
 *   applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
 *     // Process actions and update state
 *     return updatedState;
 *   }
 * }
 * ```
 */
export interface GameRulesAdapter {
  /**
   * Identifiant unique du type de jeu (ex: 'dame-nature', 'corridor').
   * Doit correspondre au gameType dans les manifests et la base de donnÃƒÆ’Ã‚Â©es.
   */
  readonly gameType: string;

  /**
   * CatÃƒÆ’Ã‚Â©gorie principale du jeu (ex: 'cartes', 'plateau', 'action').
   */
  readonly category: string;

  /**
   * Sous-catÃƒÆ’Ã‚Â©gorie optionnelle pour une classification plus fine.
   */
  readonly subcategory?: string;

  /**
   * Nom d'affichage du jeu pour l'interface utilisateur.
   */
  readonly displayName: string;

  /**
   * Description courte du jeu.
   */
  readonly description?: string;

  /**
   * Nombre minimum de joueurs requis pour dÃƒÆ’Ã‚Â©marrer une partie.
   */
  readonly minPlayers?: number;

  /**
   * Nombre maximum de joueurs autorisÃƒÆ’Ã‚Â©s dans une partie.
   */
  readonly maxPlayers?: number;

  /**
   * Demande au moteur de journaliser automatiquement les arrivÃƒÆ’Ã‚Â©es sur le plateau.
   * Retourne `false` par dÃƒÆ’Ã‚Â©faut si la logique reste dÃƒÆ’Ã‚Â©portÃƒÆ’Ã‚Â©e dans le jeu lui-mÃƒÆ’Ã‚Âªme.
   */
  shouldAnnounceBoardArrivals?(): boolean;

  /**
   * Hydrate l'ÃƒÆ’Ã‚Â©tat initial du jeu avec les mÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es et structures spÃƒÆ’Ã‚Â©cifiques.
   *
   * Cette mÃƒÆ’Ã‚Â©thode est appelÃƒÆ’Ã‚Â©e lors de la crÃƒÆ’Ã‚Â©ation d'une nouvelle partie.
   * Elle doit initialiser les mÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es du jeu, distribuer les ressources initiales,
   * et prÃƒÆ’Ã‚Â©parer l'ÃƒÆ’Ã‚Â©tat pour le dÃƒÆ’Ã‚Â©but de la partie.
   *
   * @param baseState - ÃƒÆ’Ã¢â‚¬Â°tat de base fourni par le moteur (joueurs, room, etc.)
   * @returns ÃƒÆ’Ã¢â‚¬Â°tat enrichi avec les donnÃƒÆ’Ã‚Â©es spÃƒÆ’Ã‚Â©cifiques au jeu
   *
   * @example
   * ```typescript
   * hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
   *   const metadata: MyGameMetadata = {
   *     phase: 'setup',
   *     round: 1,
   *     deck: this.setupService.createDeck(),
   *   };
   *
   *   return {
   *     ...baseState,
   *     metadata,
   *     status: 'started',
   *     turnIndex: 0,
   *   };
   * }
   * ```
   */
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity;

  /**
   * Applique une liste d'actions ÃƒÆ’Ã‚Â  l'ÃƒÆ’Ã‚Â©tat actuel et retourne le nouvel ÃƒÆ’Ã‚Â©tat.
   *
   * Cette mÃƒÆ’Ã‚Â©thode est le cÃƒâ€¦Ã¢â‚¬Å“ur de la logique du jeu. Elle doit :
   * - Traiter chaque action de maniÃƒÆ’Ã‚Â¨re sÃƒÆ’Ã‚Â©quentielle
   * - Mettre ÃƒÆ’Ã‚Â  jour l'ÃƒÆ’Ã‚Â©tat du jeu en consÃƒÆ’Ã‚Â©quence
   * - GÃƒÆ’Ã‚Â©rer les transitions de phase/tour
   * - DÃƒÆ’Ã‚Â©clencher les bots si nÃƒÆ’Ã‚Â©cessaire
   * - VÃƒÆ’Ã‚Â©rifier les conditions de victoire
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param actions - Liste des actions ÃƒÆ’Ã‚Â  appliquer
   * @returns Nouvel ÃƒÆ’Ã‚Â©tat aprÃƒÆ’Ã‚Â¨s application des actions
   *
   * @throws {GameStateError} Si l'ÃƒÆ’Ã‚Â©tat est invalide
   * @throws {PlayerActionError} Si une action n'est pas autorisÃƒÆ’Ã‚Â©e
   *
   * @example
   * ```typescript
   * applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
   *   let currentState = state;
   *
   *   for (const action of actions) {
   *     currentState = this.processAction(currentState, action);
   *     currentState = this.checkVictory(currentState);
   *   }
   *
   *   return currentState;
   * }
   * ```
   */
  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity;
  /**
   * Optionnel : SuggÃƒÆ’Ã‚Â¨re des actions pour un bot dans l'ÃƒÆ’Ã‚Â©tat courant.
   *
   * Cette mÃƒÆ’Ã‚Â©thode permet d'implÃƒÆ’Ã‚Â©menter une IA simple pour les bots.
   * Elle doit retourner une liste d'actions que le bot devrait exÃƒÆ’Ã‚Â©cuter.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param botPlayerId - ID du joueur bot
   * @returns Liste d'actions suggÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â©es ou null si aucune action
   *
   * @deprecated PrÃƒÆ’Ã‚Â©fÃƒÆ’Ã‚Â©rer getBotStrategy() pour une IA plus sophistiquÃƒÆ’Ã‚Â©e
   */
  getBotActions?(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;

  /**
   * Optionnel : Fournit une stratÃƒÆ’Ã‚Â©gie de bot plus riche (IA, heuristique).
   *
   * Permet d'implÃƒÆ’Ã‚Â©menter des bots avec diffÃƒÆ’Ã‚Â©rents niveaux de difficultÃƒÆ’Ã‚Â©
   * et stratÃƒÆ’Ã‚Â©gies (agressif, dÃƒÆ’Ã‚Â©fensif, alÃƒÆ’Ã‚Â©atoire, etc.).
   *
   * @returns StratÃƒÆ’Ã‚Â©gie de bot ou null si non implÃƒÆ’Ã‚Â©mentÃƒÆ’Ã‚Â©
   */
  getBotStrategy?(): BotStrategy | null;

  /**
   * Optionnel : Liste des actions lÃƒÆ’Ã‚Â©gales pour un joueur donnÃƒÆ’Ã‚Â©.
   *
   * Retourne toutes les actions qu'un joueur peut effectuer dans l'ÃƒÆ’Ã‚Â©tat actuel.
   * UtilisÃƒÆ’Ã‚Â© par l'interface utilisateur pour afficher les options disponibles.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param playerId - ID du joueur
   * @returns Liste des actions disponibles
   *
   * @example
   * ```typescript
   * getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
   *   const meta = state.metadata as MyGameMetadata;
   *   const actions: GameSingleActionDto[] = [];
   *
   *   if (state.turn?.currentPlayerId === playerId) {
   *     if (meta.canDraw) {
   *       actions.push({ type: 'draw', payload: {} });
   *     }
   *     if (meta.canDiscard) {
   *       actions.push({ type: 'discard', payload: { cardId: '...' } });
   *     }
   *   }
   *
   *   return actions;
   * }
   * ```
   */
  getAvailableActions?(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[];

  /**
   * Optionnel : Validation et normalisation d'une action pour un acteur donnÃƒÆ’Ã‚Â©.
   *
   * Cette mÃƒÆ’Ã‚Â©thode est appelÃƒÆ’Ã‚Â©e par le moteur aprÃƒÆ’Ã‚Â¨s les validations gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©riques.
   * Elle doit vÃƒÆ’Ã‚Â©rifier que l'action est lÃƒÆ’Ã‚Â©gale dans le contexte actuel du jeu
   * et normaliser le payload si nÃƒÆ’Ã‚Â©cessaire.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param action - Action ÃƒÆ’Ã‚Â  valider
   * @param actorId - ID de l'acteur effectuant l'action (peut ÃƒÆ’Ã‚Âªtre null)
   * @returns Action validÃƒÆ’Ã‚Â©e et normalisÃƒÆ’Ã‚Â©e
   *
   * @throws {GameValidationError} Si l'action est invalide
   * @throws {PlayerActionError} Si l'action n'est pas autorisÃƒÆ’Ã‚Â©e pour ce joueur
   *
   * @example
   * ```typescript
   * validateAction(
   *   state: GameStateEntity,
   *   action: GameSingleActionDto,
   *   actorId: number | null,
   * ): GameSingleActionDto {
   *   const type = action.type as MyGameActionType;
   *
   *   // VÃƒÆ’Ã‚Â©rifier que c'est bien le tour du joueur
   *   if (state.turn?.currentPlayerId !== actorId) {
   *     throw new PlayerActionError("Ce n'est pas votre tour", {
   *       gameType: this.gameType,
   *       playerId: actorId,
   *       currentPlayerId: state.turn?.currentPlayerId,
   *     });
   *   }
   *
   *   // Normaliser le payload
   *   const payload = { ...action.payload };
   *   if (type === 'draw') {
   *     // Pas de payload nÃƒÆ’Ã‚Â©cessaire
   *     return { ...action, type, payload: {} };
   *   }
   *
   *   return { ...action, type, payload };
   * }
   * ```
   */
  validateAction?(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto;

  /**
   * Optionnel : Validation personnalisÃƒÆ’Ã‚Â©e des acteurs.
   *
   * Permet de contrÃƒÆ’Ã‚Â´ler finement qui peut effectuer des actions.
   * Si retourne true, le moteur ne bloque pas sur currentPlayerId.
   *
   * Utile pour les jeux oÃƒÆ’Ã‚Â¹ plusieurs joueurs peuvent agir simultanÃƒÆ’Ã‚Â©ment
   * ou oÃƒÆ’Ã‚Â¹ certaines actions ne sont pas liÃƒÆ’Ã‚Â©es au systÃƒÆ’Ã‚Â¨me de tours.
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param actions - Actions ÃƒÆ’Ã‚Â  valider
   * @param actorId - ID de l'acteur
   * @returns true si l'acteur est valide, false sinon
   */
  validateActor?(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean;

  /**
   * Optionnel : Fournit un ÃƒÆ’Ã‚Â©tat enrichi avec actions/pending pour le client.
   *
   * Permet de personnaliser l'ÃƒÆ’Ã‚Â©tat exposÃƒÆ’Ã‚Â© au client en ajoutant des
   * informations complÃƒÆ’Ã‚Â©mentaires (actions disponibles, ÃƒÆ’Ã‚Â©tat en attente, etc.).
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @returns ÃƒÆ’Ã¢â‚¬Â°tat enrichi pour tous les utilisateurs
   */
  exposeState?(state: GameStateEntity): GameStateWithActions;

  /**
   * Optionnel : Fournit un ÃƒÆ’Ã‚Â©tat enrichi personnalisÃƒÆ’Ã‚Â© pour un utilisateur.
   *
   * Permet de masquer certaines informations selon le joueur
   * (main des adversaires, cartes cachÃƒÆ’Ã‚Â©es, etc.).
   *
   * @param state - ÃƒÆ’Ã¢â‚¬Â°tat actuel du jeu
   * @param userId - ID de l'utilisateur
   * @returns ÃƒÆ’Ã¢â‚¬Â°tat enrichi personnalisÃƒÆ’Ã‚Â© pour cet utilisateur
   *
   * @example
   * ```typescript
   * exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
   *   const meta = state.metadata as MyGameMetadata;
   *   const players = state.players.map(p => {
   *     const player = p as MyPlayerState;
   *     return {
   *       ...player,
   *       // Masquer la main des autres joueurs
   *       hand: player.id === userId ? player.hand : [],
   *       handCount: player.hand.length,
   *     };
   *   });
   *
   *   return {
   *     ...state,
   *     players,
   *     metadata: meta,
   *     availableActions: this.getAvailableActions?.(state, userId) || [],
   *   };
   * }
   * ```
   */
  exposeStateForUser?(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions;

  /**
   * Optionnel : dÃƒÆ’Ã¢â‚¬Â¡Ãƒâ€šÃ‚Â¸clare les raccourcis clavier gÃƒÆ’Ã¢â‚¬Â¡Ãƒâ€šÃ‚Â¸rÃƒÆ’Ã¢â‚¬Â¡Ãƒâ€šÃ‚Â¸s par ce jeu.
   *
   * Le client ne doit pas dÃƒÆ’Ã¢â‚¬Â¡Ãƒâ€šÃ‚Â¸duire de rÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã‚Â¹gles : il affiche simplement ces hints
   * et envoie les touches au serveur (`game.key`). Le moteur route ensuite
   * vers le jeu en cours.
   */
  getShortcuts?(ctx: GameShortcutsContext<unknown>): GameShortcutHint[];
}

/**
 * DÃƒÆ’Ã‚Â©finition statique d'un jeu pour l'enregistrement dans le moteur.
 *
 * Contient les mÃƒÆ’Ã‚Â©tadonnÃƒÆ’Ã‚Â©es de base d'un jeu utilisÃƒÆ’Ã‚Â©es pour la dÃƒÆ’Ã‚Â©couverte,
 * le catalogue et l'initialisation.
 */
export type GameDefinition = {
  /**
   * Identifiant unique du jeu (doit correspondre ÃƒÆ’Ã‚Â  gameType de l'adaptateur).
   */
  id: string;

  /**
   * Nom d'affichage du jeu.
   */
  name: string;

  /**
   * CatÃƒÆ’Ã‚Â©gorie principale (ex: 'cartes', 'plateau', 'action').
   */
  category: string;

  /**
   * Sous-catÃƒÆ’Ã‚Â©gorie optionnelle.
   */
  subcategory?: string;

  /**
   * Description du jeu.
   */
  description?: string;

  /**
   * Nombre minimum de joueurs.
   */
  minPlayers?: number;

  /**
   * Nombre maximum de joueurs.
   */
  maxPlayers?: number;

  /**
   * Active/dÃƒÆ’Ã‚Â©sactive le chat ÃƒÆ’Ã‚Â©phÃƒÆ’Ã‚Â©mÃƒÆ’Ã‚Â¨re en table pour ce jeu.
   * Par dÃƒÆ’Ã‚Â©faut: true.
   */
  chatEnabled?: boolean;

  /**
   * Active/dÃƒÆ’Ã‚Â©sactive les sons liÃƒÆ’Ã‚Â©s au chat de table.
   * Par dÃƒÆ’Ã‚Â©faut: true.
   */
  chatSoundsEnabled?: boolean;

  /**
   * Statut catalogue du jeu.
   * - construction : visible admins uniquement
   * - beta : visible admins + utilisateurs ayant activÃƒÆ’Ã‚Â© l'option bÃƒÆ’Ã‚Âªta
   * - finished : visible pour tous
   */
  status?: 'construction' | 'beta' | 'finished';

  /**
   * Chemin vers le fichier manifest.json du jeu.
   */
  manifestPath?: string;

  /**
   * Chemin vers le fichier de rÃƒÆ’Ã‚Â¨gles (Markdown).
   */
  rulesPath?: string;
};




