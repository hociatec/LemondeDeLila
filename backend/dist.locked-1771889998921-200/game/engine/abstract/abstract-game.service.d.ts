import { OnModuleInit } from '@nestjs/common';
import { GameStateEntity, PlayerStateEntity } from '../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../dto/game-action.dto';
import { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../services/game-registry.service';
export declare abstract class AbstractGameService implements GameRulesAdapter, OnModuleInit {
    protected readonly registry: GameRegistryService;
    abstract readonly gameType: string;
    abstract readonly category: string;
    abstract readonly subcategory?: string;
    abstract readonly displayName: string;
    abstract readonly description?: string;
    abstract readonly minPlayers?: number;
    abstract readonly maxPlayers?: number;
    constructor(registry: GameRegistryService);
    onModuleInit(): void;
    abstract hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    abstract applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    protected extractActorId(action: GameSingleActionDto): number | null;
    protected isPlayerBot(playerId: number, state: GameStateEntity): boolean;
    protected setBotThinkingFlag(state: GameStateEntity): GameStateEntity;
    protected findPlayer(playerId: number, state: GameStateEntity): PlayerStateEntity | null;
    protected getCurrentPlayer(state: GameStateEntity): PlayerStateEntity | null;
    protected isStarted(state: GameStateEntity): boolean;
    protected isFinished(state: GameStateEntity): boolean;
    shouldAnnounceBoardArrivals(): boolean;
}
