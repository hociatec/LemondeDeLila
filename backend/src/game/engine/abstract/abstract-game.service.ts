import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameStateEntity } from '../../core/entities/game-state.entity';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../dto/game-action.dto';
import { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../services/game-registry.service';

/**
 * Abstract base class for game services.
 * Provides common utilities and enforces the GameRulesAdapter interface.
 *
 * Concrete game services should extend this class and implement:
 * - Game metadata properties (gameType, displayName, etc.)
 * - hydrateInitialState() - Initialize game-specific state
 * - applyActions() - Apply game-specific actions
 * - Optional methods: getBotActions, getAvailableActions, etc.
 */
@Injectable()
export abstract class AbstractGameService
  implements GameRulesAdapter, OnModuleInit
{
  // Required metadata properties (must be set by concrete classes)
  abstract readonly gameType: string;
  abstract readonly category: string;
  abstract readonly subcategory?: string;
  abstract readonly displayName: string;
  abstract readonly description?: string;
  abstract readonly minPlayers?: number;
  abstract readonly maxPlayers?: number;

  constructor(protected readonly registry: GameRegistryService) {}

  /**
   * Registers this game service with the game registry on module initialization.
   * This method is identical across all game services.
   */
  onModuleInit(): void {
    this.registry.register(this);
  }

  /**
   * Initialize game-specific state from a base state.
   * Each game implements its own initialization logic.
   */
  abstract hydrateInitialState(baseState: GameStateEntity): GameStateEntity;

  /**
   * Apply a list of actions to the current game state.
   * Each game implements its own action handling logic.
   */
  abstract applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity;

  // ============================================================================
  // COMMON UTILITY METHODS
  // ============================================================================

  /**
   * Extracts the actor ID from an action's metadata.
   * Returns null if not present or invalid.
   */
  protected extractActorId(action: GameSingleActionDto): number | null {
    const candidate = (action.meta as any)?.actorId;
    return typeof candidate === 'number' ? candidate : null;
  }

  /**
   * Checks if a player with the given ID is a bot in the current state.
   */
  protected isPlayerBot(playerId: number, state: GameStateEntity): boolean {
    const player = (state.players ?? []).find((p) => p.id === playerId);
    return player?.isBot ?? false;
  }

  /**
   * Sets the botThinking flag based on whether the current player is a bot.
   * This is a common pattern across all game services.
   */
  protected setBotThinkingFlag(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId === null) {
      return { ...state, botThinking: false };
    }
    const isBot = this.isPlayerBot(currentId, state);
    return { ...state, botThinking: isBot };
  }

  /**
   * Finds a player by ID in the current state.
   * Returns null if not found.
   */
  protected findPlayer(playerId: number, state: GameStateEntity): any | null {
    const players = state.players ?? [];
    return players.find((p) => p.id === playerId) ?? null;
  }

  /**
   * Gets the current player from the state.
   * Returns null if no current player or player not found.
   */
  protected getCurrentPlayer(state: GameStateEntity): any | null {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId === null) return null;
    return this.findPlayer(currentId, state);
  }

  /**
   * Checks if the game has started (status is 'started').
   */
  protected isStarted(state: GameStateEntity): boolean {
    return (state.status || '').toLowerCase() === 'started';
  }

  /**
   * Checks if the game is finished (status is 'finished').
   */
  protected isFinished(state: GameStateEntity): boolean {
    return (state.status || '').toLowerCase() === 'finished';
  }

  shouldAnnounceBoardArrivals(): boolean {
    return false;
  }
}
