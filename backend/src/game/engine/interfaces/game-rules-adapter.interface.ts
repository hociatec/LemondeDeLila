import { GameStateEntity } from '../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../dto/game-action.dto';

export interface BotStrategy {
  suggest(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] | null;
}

export interface GameRulesAdapter {
  readonly gameType: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly displayName: string;
  readonly description?: string;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
  /**
   * Optionnel : suggère des actions pour un bot donné dans l’état courant.
   */
  getBotActions?(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] | null;

  /**
   * Optionnel : stratégie de bot plus riche (IA, heuristique).
   */
  getBotStrategy?(): BotStrategy | null;

  /**
   * Optionnel : liste des actions légales pour un joueur donné.
   */
  getAvailableActions?(state: GameStateEntity, playerId: number): GameSingleActionDto[];
}

export type GameDefinition = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  manifestPath?: string;
  rulesPath?: string;
};
