import { GameStateEntity } from '../../core/entities/game-state.entity';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../dto/game-action.dto';
import type { BotStrategy } from '../../modules/bot/bot-strategy.interface';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../shortcuts/game-shortcuts';

/**
 * Interface principale pour les adaptateurs de règles de jeu.
 *
 * Chaque jeu doit implémenter cette interface pour s'intégrer au moteur de jeu.
 * L'adaptateur gère l'initialisation, la validation et l'application des actions,
 * ainsi que l'exposition de l'état pour les clients.
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
   * Doit correspondre au gameType dans les manifests et la base de données.
   */
  readonly gameType: string;

  /**
   * Catégorie principale du jeu (ex: 'cartes', 'plateau', 'action').
   */
  readonly category: string;

  /**
   * Sous-catégorie optionnelle pour une classification plus fine.
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
   * Nombre minimum de joueurs requis pour démarrer une partie.
   */
  readonly minPlayers?: number;

  /**
   * Nombre maximum de joueurs autorisés dans une partie.
   */
  readonly maxPlayers?: number;

  /**
   * Hydrate l'état initial du jeu avec les métadonnées et structures spécifiques.
   *
   * Cette méthode est appelée lors de la création d'une nouvelle partie.
   * Elle doit initialiser les métadonnées du jeu, distribuer les ressources initiales,
   * et préparer l'état pour le début de la partie.
   *
   * @param baseState - État de base fourni par le moteur (joueurs, room, etc.)
   * @returns État enrichi avec les données spécifiques au jeu
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
   * Applique une liste d'actions à l'état actuel et retourne le nouvel état.
   *
   * Cette méthode est le cœur de la logique du jeu. Elle doit :
   * - Traiter chaque action de manière séquentielle
   * - Mettre à jour l'état du jeu en conséquence
   * - Gérer les transitions de phase/tour
   * - Déclencher les bots si nécessaire
   * - Vérifier les conditions de victoire
   *
   * @param state - État actuel du jeu
   * @param actions - Liste des actions à appliquer
   * @returns Nouvel état après application des actions
   *
   * @throws {GameStateError} Si l'état est invalide
   * @throws {PlayerActionError} Si une action n'est pas autorisée
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
   * Optionnel : Suggère des actions pour un bot dans l'état courant.
   *
   * Cette méthode permet d'implémenter une IA simple pour les bots.
   * Elle doit retourner une liste d'actions que le bot devrait exécuter.
   *
   * @param state - État actuel du jeu
   * @param botPlayerId - ID du joueur bot
   * @returns Liste d'actions suggérées ou null si aucune action
   *
   * @deprecated Préférer getBotStrategy() pour une IA plus sophistiquée
   */
  getBotActions?(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;

  /**
   * Optionnel : Fournit une stratégie de bot plus riche (IA, heuristique).
   *
   * Permet d'implémenter des bots avec différents niveaux de difficulté
   * et stratégies (agressif, défensif, aléatoire, etc.).
   *
   * @returns Stratégie de bot ou null si non implémenté
   */
  getBotStrategy?(): BotStrategy | null;

  /**
   * Optionnel : Liste des actions légales pour un joueur donné.
   *
   * Retourne toutes les actions qu'un joueur peut effectuer dans l'état actuel.
   * Utilisé par l'interface utilisateur pour afficher les options disponibles.
   *
   * @param state - État actuel du jeu
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
   * Optionnel : Validation et normalisation d'une action pour un acteur donné.
   *
   * Cette méthode est appelée par le moteur après les validations génériques.
   * Elle doit vérifier que l'action est légale dans le contexte actuel du jeu
   * et normaliser le payload si nécessaire.
   *
   * @param state - État actuel du jeu
   * @param action - Action à valider
   * @param actorId - ID de l'acteur effectuant l'action (peut être null)
   * @returns Action validée et normalisée
   *
   * @throws {GameValidationError} Si l'action est invalide
   * @throws {PlayerActionError} Si l'action n'est pas autorisée pour ce joueur
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
   *   // Vérifier que c'est bien le tour du joueur
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
   *     // Pas de payload nécessaire
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
   * Optionnel : Validation personnalisée des acteurs.
   *
   * Permet de contrôler finement qui peut effectuer des actions.
   * Si retourne true, le moteur ne bloque pas sur currentPlayerId.
   *
   * Utile pour les jeux où plusieurs joueurs peuvent agir simultanément
   * ou où certaines actions ne sont pas liées au système de tours.
   *
   * @param state - État actuel du jeu
   * @param actions - Actions à valider
   * @param actorId - ID de l'acteur
   * @returns true si l'acteur est valide, false sinon
   */
  validateActor?(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean;

  /**
   * Optionnel : Fournit un état enrichi avec actions/pending pour le client.
   *
   * Permet de personnaliser l'état exposé au client en ajoutant des
   * informations complémentaires (actions disponibles, état en attente, etc.).
   *
   * @param state - État actuel du jeu
   * @returns État enrichi pour tous les utilisateurs
   */
  exposeState?(state: GameStateEntity): GameStateWithActions;

  /**
   * Optionnel : Fournit un état enrichi personnalisé pour un utilisateur.
   *
   * Permet de masquer certaines informations selon le joueur
   * (main des adversaires, cartes cachées, etc.).
   *
   * @param state - État actuel du jeu
   * @param userId - ID de l'utilisateur
   * @returns État enrichi personnalisé pour cet utilisateur
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
   * Optionnel : dÇ¸clare les raccourcis clavier gÇ¸rÇ¸s par ce jeu.
   *
   * Le client ne doit pas dÇ¸duire de rÇùgles : il affiche simplement ces hints
   * et envoie les touches au serveur (`game.key`). Le moteur route ensuite
   * vers le jeu en cours.
   */
  getShortcuts?(ctx: GameShortcutsContext<any>): GameShortcutHint[];
}

/**
 * Définition statique d'un jeu pour l'enregistrement dans le moteur.
 *
 * Contient les métadonnées de base d'un jeu utilisées pour la découverte,
 * le catalogue et l'initialisation.
 */
export type GameDefinition = {
  /**
   * Identifiant unique du jeu (doit correspondre à gameType de l'adaptateur).
   */
  id: string;

  /**
   * Nom d'affichage du jeu.
   */
  name: string;

  /**
   * Catégorie principale (ex: 'cartes', 'plateau', 'action').
   */
  category: string;

  /**
   * Sous-catégorie optionnelle.
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
   * Active/désactive le chat éphémère en table pour ce jeu.
   * Par défaut: true.
   */
  chatEnabled?: boolean;

  /**
   * Active/désactive les sons liés au chat de table.
   * Par défaut: true.
   */
  chatSoundsEnabled?: boolean;

  /**
   * Chemin vers le fichier manifest.json du jeu.
   */
  manifestPath?: string;

  /**
   * Chemin vers le fichier de règles (Markdown).
   */
  rulesPath?: string;
};
